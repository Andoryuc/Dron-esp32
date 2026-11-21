/**
 * @file modo-wifi.js
 * @brief Servidor Wi-Fi Integrado (HTTP Puerto 8080 + WebSocket Nativo RFC 6455 Puerto 81),
 *        Servidor de Descarga Directa de APK (/apk y /uav-control.apk) y Emulador en Tiempo Real
 *        del Controlador de Vuelo ESP32 + MPU6050 a 50 Hz.
 * @details Construido exclusivamente con módulos nativos de Node.js (http, crypto, fs, path, os)
 *          sin dependencias externas. Recibe los joysticks del teléfono Android por Wi-Fi,
 *          ejecuta la dinámica MPU6050 + PID + Failsafe a 50 Hz y mueve el simulador 2D del portátil.
 *
 * Uso:
 *   node simulador-pc/modo-wifi.js
 */

"use strict";

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ============================================================================
// 1. CONFIGURACIÓN DE PUERTOS Y RUTAS DE ARCHIVOS
// ============================================================================
const HTTP_PORT = 8080;
const WS_PORT = 81;
const PREFERRED_WIFI_IP = "192.168.39.42";
const LOOP_DT_MS = 20; // 50 Hz (20 ms)
const HEARTBEAT_TIMEOUT_MS = 400;
const AUTO_BRAKE_MS = 800;
const TOUCHDOWN_HOLD_MS = 1500;
const GLITCH_TOL_MS = 150;

const ROOT_DIR = path.resolve(__dirname, "..");
const APP_WWW_DIR = path.join(ROOT_DIR, "app-android", "www");
const SIM_DIR = __dirname;
const APK_RELEASE_PATH = path.join(ROOT_DIR, "releases", "dron-oficial.apk");
const APK_WWW_PATH = path.join(APP_WWW_DIR, "uav-control.apk");
const APK_GRADLE_FALLBACK = path.join(
  ROOT_DIR,
  "app-android",
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "oficial",
  "debug",
  "app-oficial-debug.apk"
);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".apk": "application/vnd.android.package-archive"
};

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  if (!ips.includes(PREFERRED_WIFI_IP)) {
    ips.unshift(PREFERRED_WIFI_IP);
  }
  return ips;
}

// ============================================================================
// 2. IMPLEMENTACIÓN NATIVA DE WEBSOCKET (RFC 6455) SIN PAQUETES EXTERNOS
// ============================================================================
const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const wsClients = new Set();

function encodeWsTextFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + Opcode 0x1 (Text)
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeWsFrames(buffer, onMessage, onClose, onPing) {
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const byte0 = buffer[offset];
    const byte1 = buffer[offset + 1];
    const opcode = byte0 & 0x0f;
    const isMasked = (byte1 & 0x80) !== 0;
    let payloadLen = byte1 & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }

    const maskKeyLen = isMasked ? 4 : 0;
    const totalFrameLen = headerLen + maskKeyLen + payloadLen;
    if (offset + totalFrameLen > buffer.length) break;

    const payloadStart = offset + headerLen + maskKeyLen;
    const payload = Buffer.alloc(payloadLen);

    if (isMasked) {
      const maskOffset = offset + headerLen;
      for (let i = 0; i < payloadLen; i++) {
        payload[i] = buffer[payloadStart + i] ^ buffer[maskOffset + (i & 3)];
      }
    } else {
      buffer.copy(payload, 0, payloadStart, payloadStart + payloadLen);
    }

    if (opcode === 0x01) {
      onMessage(payload.toString("utf8"));
    } else if (opcode === 0x08) {
      onClose();
      return Buffer.alloc(0);
    } else if (opcode === 0x09) {
      onPing(payload);
    }

    offset += totalFrameLen;
  }

  return buffer.slice(offset);
}

function handleWebSocketUpgrade(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptHash = crypto
    .createHash("sha1")
    .update(key + WS_MAGIC_GUID, "binary")
    .digest("base64");

  const responseHeaders = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptHash}`,
    "\r\n"
  ].join("\r\n");

  socket.setNoDelay(true);
  socket.write(responseHeaders);

  const client = {
    socket,
    role: "unknown",
    rxBuffer: Buffer.alloc(0)
  };
  wsClients.add(client);

  socket.on("data", (chunk) => {
    client.rxBuffer = Buffer.concat([client.rxBuffer, chunk]);
    client.rxBuffer = decodeWsFrames(
      client.rxBuffer,
      (msgStr) => processIncomingWsJson(client, msgStr),
      () => {
        wsClients.delete(client);
        socket.end();
      },
      (pingPayload) => {
        const pongHeader = Buffer.from([0x8a, pingPayload.length & 0x7f]);
        try {
          socket.write(Buffer.concat([pongHeader, pingPayload]));
        } catch (_e) {}
      }
    );
  });

  socket.on("close", () => {
    wsClients.delete(client);
  });

  socket.on("error", () => {
    wsClients.delete(client);
  });
}

function broadcastJsonFrame(jsonString) {
  if (wsClients.size === 0) return;
  const frame = encodeWsTextFrame(jsonString);
  for (const client of wsClients) {
    try {
      client.socket.write(frame);
    } catch (_e) {
      wsClients.delete(client);
    }
  }
}

// ============================================================================
// 3. EMULADOR DEL CONTROLADOR DE VUELO ESP32 + MPU6050 + FSM JARVIS A 50 Hz
// ============================================================================
const cmdInput = {
  lx: 0.0,
  ly: 0.0,
  rx: 0.0,
  ry: -1.0,
  armRequested: false,
  killRequested: false,
  rssi: -55,
  rssiOverride: false,
  px: 0.0,
  py: 2.0,
  pilotVx: 0.0,
  pilotVy: 0.0
};

const simWorld = {
  droneX: 0.0,
  droneY: 0.0,
  droneVx: 0.0,
  droneVy: 0.0,
  headingRad: 0.0,
  pilotX: 0.0,
  pilotY: 2.0
};

const VOICE_RESPONSES = {
  CMD_ARM: "En línea, señor. Sistemas calibrados. Prueba secuencial de motores completada. Cuadricóptero en ralentí listo para despegue.",
  CMD_TAKEOFF: "Ascendiendo a altitud de crucero. Estabilización giroscópica activa.",
  CMD_FOLLOW: "Modo seguimiento activado. Enganchando telemetría de señal Wi-Fi y vector de movimiento del piloto.",
  CMD_PATROL: "Iniciando barrido perimetral de trescientos sesenta grados.",
  CMD_DANCE: "Activando protocolo de baile acrobático en posición segura.",
  CMD_LAND: "Iniciando descenso autónomo amortiguado. Motores en corte seguro.",
  CMD_LAND_DONE: "Aterrizaje completado. Motores apagados.",
  CMD_MANUAL: "Transfiriendo mando manual al piloto.",
  ALERT_WIFI_RETURN: "Alerta de cobertura Wi-Fi. Acercando aeronave hacia la señal del piloto.",
  ALERT_BRAKE: "Alerta crítica de alcance. Ejecutando frenado vectorial automático.",
  ALERT_KILL: "Corte de emergencia ejecutado. Motores desenergizados."
};

const imu = {
  pitch_deg: 0.0,
  roll_deg: 0.0,
  yaw_deg: 0.0,
  gx_dps: 0.0,
  gy_dps: 0.0,
  gz_dps: 0.0,
  az_g: 1.0,
  verticalVelEst: 0.0
};

class PidController {
  constructor(kp, ki, kd, integralLimit, outputLimit) {
    this.kp = kp;
    this.ki = ki;
    this.kd = kd;
    this.integral = 0.0;
    this.prevMeasurement = 0.0;
    this.integralLimit = integralLimit;
    this.outputLimit = outputLimit;
  }

  compute(setpoint, measurement, dt) {
    const error = setpoint - measurement;
    this.integral = Math.max(-this.integralLimit, Math.min(this.integralLimit, this.integral + error * dt));
    const derivative = -(measurement - this.prevMeasurement) / dt;
    this.prevMeasurement = measurement;
    const out = this.kp * error + this.ki * this.integral + this.kd * derivative;
    return Math.max(-this.outputLimit, Math.min(this.outputLimit, out));
  }

  reset() {
    this.integral = 0.0;
    this.prevMeasurement = 0.0;
  }
}

const pidPitch = new PidController(4.2, 0.18, 1.15, 120.0, 320.0);
const pidRoll  = new PidController(4.2, 0.18, 1.15, 120.0, 320.0);
const pidYaw   = new PidController(2.8, 0.05, 0.00, 80.0,  180.0);

let flightState = "IDLE_DISARMED";
let motorPwm = [0, 0, 0, 0];
let batteryVoltage = 3.95;

let hasActiveController = false;
let lastControllerPacketMs = Date.now();
let stateEntryMs = Date.now();
let autoBrakeStartMs = 0;
let autoBrakeLock = false;
let lastValidPitchDeg = 0.0;
let lastValidRollDeg = 0.0;

let currentThrottlePwm = 0.0;
let autoReturnWifiActive = false;
let lastVoiceMsg = "JARVIS en espera de órdenes por voz.";
let lastVoiceSeq = 0;

let failsafeStartMs = 0;
let failsafeEntryPwm = 593.0;
let failsafeEntryRy = 0.10;
let inTouchdownWindow = false;
let touchdownStableSinceMs = 0;
let inGlitchWindow = false;
let glitchStartMs = 0;

function emitVoiceAnnouncement(msg) {
  if (!msg) return;
  lastVoiceMsg = msg;
  lastVoiceSeq++;
}

function triggerAutonomousCommand(cmdCode) {
  const nowMs = Date.now();
  const cmd = String(cmdCode || "").trim().toUpperCase();
  if (!cmd) return;

  cmdInput.killRequested = false;
  autoReturnWifiActive = false;

  if (cmd === "CMD_ARM") {
    cmdInput.armRequested = true;
    flightState = "ARMING_SEQ";
    stateEntryMs = nowMs;
    currentThrottlePwm = 205.0; // 20% de 1023
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.rx = 0.0;
    cmdInput.ry = -0.60;
    pidPitch.reset();
    pidRoll.reset();
    pidYaw.reset();
    emitVoiceAnnouncement(VOICE_RESPONSES.CMD_ARM);
  } else if (cmd === "CMD_TAKEOFF") {
    cmdInput.armRequested = true;
    if (currentThrottlePwm < 205.0) currentThrottlePwm = 205.0;
    flightState = "AUTO_TAKEOFF";
    stateEntryMs = nowMs;
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.rx = 0.0;
    cmdInput.ry = 0.10;
    emitVoiceAnnouncement(VOICE_RESPONSES.CMD_TAKEOFF);
  } else if (cmd === "CMD_FOLLOW") {
    cmdInput.armRequested = true;
    if (currentThrottlePwm < 593.0) currentThrottlePwm = 593.0;
    flightState = "FOLLOW_ME";
    stateEntryMs = nowMs;
    cmdInput.ry = 0.10;
    emitVoiceAnnouncement(VOICE_RESPONSES.CMD_FOLLOW);
  } else if (cmd === "CMD_PATROL") {
    cmdInput.armRequested = true;
    if (currentThrottlePwm < 593.0) currentThrottlePwm = 593.0;
    flightState = "PATROL_360";
    stateEntryMs = nowMs;
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.ry = 0.10;
    emitVoiceAnnouncement(VOICE_RESPONSES.CMD_PATROL);
  } else if (cmd === "CMD_DANCE") {
    cmdInput.armRequested = true;
    if (currentThrottlePwm < 593.0) currentThrottlePwm = 593.0;
    flightState = "DANCE_MODE";
    stateEntryMs = nowMs;
    cmdInput.ry = 0.10;
    emitVoiceAnnouncement(VOICE_RESPONSES.CMD_DANCE);
  } else if (cmd === "CMD_LAND") {
    if (flightState !== "IDLE_DISARMED" && flightState !== "DISARMED") {
      flightState = "FAILSAFE_LANDING";
      stateEntryMs = nowMs;
      failsafeStartMs = nowMs;
      inTouchdownWindow = false;
      inGlitchWindow = false;
      failsafeEntryPwm = Math.max(205.0, currentThrottlePwm || 593.0);
      failsafeEntryRy = cmdInput.ry;
      cmdInput.lx = 0.0;
      cmdInput.ly = 0.0;
      cmdInput.rx = 0.0;
      emitVoiceAnnouncement(VOICE_RESPONSES.CMD_LAND);
    } else {
      flightState = "IDLE_DISARMED";
      cmdInput.armRequested = false;
      currentThrottlePwm = 0.0;
      cmdInput.ry = -1.0;
      motorPwm = [0, 0, 0, 0];
      emitVoiceAnnouncement(VOICE_RESPONSES.CMD_LAND_DONE);
    }
  } else if (cmd === "CMD_MANUAL") {
    cmdInput.armRequested = true;
    flightState = "MANUAL_FLIGHT";
    stateEntryMs = nowMs;
    if (currentThrottlePwm < 205.0) currentThrottlePwm = 593.0;
    if (cmdInput.ry < -0.5) cmdInput.ry = 0.10;
    emitVoiceAnnouncement(VOICE_RESPONSES.CMD_MANUAL);
  }
}

function processIncomingWsJson(client, rawText) {
  try {
    const pkt = JSON.parse(rawText);

    if (pkt.role === "simulator") {
      client.role = "simulator";
    } else if (pkt.role === "controller") {
      client.role = "controller";
    }

    if (typeof pkt.px === "number" && Number.isFinite(pkt.px)) {
      simWorld.pilotX = Math.max(-60.0, Math.min(60.0, pkt.px));
      cmdInput.px = simWorld.pilotX;
    }
    if (typeof pkt.py === "number" && Number.isFinite(pkt.py)) {
      simWorld.pilotY = Math.max(-60.0, Math.min(60.0, pkt.py));
      cmdInput.py = simWorld.pilotY;
    }
    if (typeof pkt.pvx === "number" && Number.isFinite(pkt.pvx)) {
      simWorld.pilotX = Math.max(-60.0, Math.min(60.0, simWorld.pilotX + pkt.pvx * 0.04));
      cmdInput.px = simWorld.pilotX;
    }
    if (typeof pkt.pvy === "number" && Number.isFinite(pkt.pvy)) {
      simWorld.pilotY = Math.max(-60.0, Math.min(60.0, simWorld.pilotY + pkt.pvy * 0.04));
      cmdInput.py = simWorld.pilotY;
    }

    if (pkt.reset_pose === 1 || pkt.reset_pose === true) {
      simWorld.droneX = 0.0;
      simWorld.droneY = 0.0;
      simWorld.droneVx = 0.0;
      simWorld.droneVy = 0.0;
      simWorld.headingRad = 0.0;
      simWorld.pilotX = 0.0;
      simWorld.pilotY = 2.0;
      cmdInput.px = 0.0;
      cmdInput.py = 2.0;
      cmdInput.rssiOverride = false;
    }

    if (typeof pkt.lx === "number" || typeof pkt.ly === "number" || typeof pkt.rx === "number" || typeof pkt.ry === "number" || typeof pkt.kill !== "undefined" || typeof pkt.arm !== "undefined" || typeof pkt.cmd === "string") {
      if (client.role !== "simulator") {
        client.role = "controller";
        hasActiveController = true;
      }
      lastControllerPacketMs = Date.now();
    }

    if (pkt.kill === 1 || pkt.kill === true) {
      cmdInput.killRequested = true;
      cmdInput.armRequested = false;
      currentThrottlePwm = 0.0;
      cmdInput.ry = -1.0;
      flightState = "EMERGENCY_KILL";
      emitVoiceAnnouncement(VOICE_RESPONSES.ALERT_KILL);
      return;
    }

    if (typeof pkt.cmd === "string" && pkt.cmd.trim() !== "") {
      triggerAutonomousCommand(pkt.cmd);
      return;
    }

    // Procesar arm/disarm explícito sin permitir que tramas periódicas {lx,ly,rx,ry} auto-armen el dron en IDLE_DISARMED
    const isPeriodicStickFrame = (typeof pkt.lx === "number" && typeof pkt.ly === "number");
    if ((pkt.arm === 0 || pkt.arm === false) && !isPeriodicStickFrame) {
      cmdInput.armRequested = false;
      currentThrottlePwm = 0.0;
      cmdInput.ry = -1.0;
      flightState = "IDLE_DISARMED";
      motorPwm = [0, 0, 0, 0];
      return;
    } else if ((pkt.arm === 1 || pkt.arm === true) && !isPeriodicStickFrame) {
      triggerAutonomousCommand("CMD_ARM");
      return;
    }

    const inAutonomousMode = (
      flightState === "ARMING_SEQ" ||
      flightState === "ARMED_IDLE" ||
      flightState === "AUTO_TAKEOFF" ||
      flightState === "FOLLOW_ME" ||
      flightState === "PATROL_360" ||
      flightState === "DANCE_MODE" ||
      flightState === "FAILSAFE_LANDING"
    );

    const incomingLx = typeof pkt.lx === "number" ? Math.max(-1.0, Math.min(1.0, pkt.lx)) : cmdInput.lx;
    const incomingLy = typeof pkt.ly === "number" ? Math.max(-1.0, Math.min(1.0, pkt.ly)) : cmdInput.ly;
    const incomingRx = typeof pkt.rx === "number" ? Math.max(-1.0, Math.min(1.0, pkt.rx)) : cmdInput.rx;
    const incomingRy = typeof pkt.ry === "number" ? Math.max(-1.0, Math.min(1.0, pkt.ry)) : cmdInput.ry;

    // Nunca cambiar a MANUAL_FLIGHT por tramas periódicas en reposo ni cancelar FAILSAFE_LANDING o ARMING_SEQ.
    // Solo transferir a MANUAL_FLIGHT si el piloto mueve físicamente los joysticks superando la zona muerta (> 0.28).
    const stickMovedOverDeadzone = (Math.hypot(incomingLx, incomingLy) > 0.28 || Math.abs(incomingRx) > 0.28);
    const canOverrideToManual = (
      flightState === "AUTO_TAKEOFF" ||
      flightState === "FOLLOW_ME" ||
      flightState === "PATROL_360" ||
      flightState === "DANCE_MODE" ||
      flightState === "ARMED_IDLE"
    );

    if (canOverrideToManual && stickMovedOverDeadzone) {
      flightState = "MANUAL_FLIGHT";
      autoReturnWifiActive = false;
      if (currentThrottlePwm < 205.0) currentThrottlePwm = 593.0;
      emitVoiceAnnouncement(VOICE_RESPONSES.CMD_MANUAL);
    }

    if (flightState === "MANUAL_FLIGHT" || flightState === "WARN_RANGE" || flightState === "AUTO_BRAKE") {
      cmdInput.lx = incomingLx;
      cmdInput.ly = incomingLy;
      cmdInput.rx = incomingRx;
      cmdInput.ry = incomingRy;
    }

    if (typeof pkt.rssi_sim === "number" && pkt.rssi_override === true) {
      cmdInput.rssi = pkt.rssi_sim;
      cmdInput.rssiOverride = true;
    } else if (pkt.rssi_override === false) {
      cmdInput.rssiOverride = false;
    }
  } catch (_e) {}
}

function getTelemetryFlag(state) {
  if (state === "EMERGENCY_KILL") return "KILL_ACTIVE";
  if (state === "FAILSAFE_LANDING") return "FAILSAFE_LANDING";
  if (state === "AUTO_BRAKE") return "AUTO_BRAKE";
  if (state === "WARN_RANGE") return "WARN_RANGE";
  if (state === "FOLLOW_ME") return autoReturnWifiActive ? "AUTO_RETURN_WIFI" : "FOLLOW_LOCK";
  if (state === "PATROL_360") return "PATROL_ACTIVE";
  if (state === "DANCE_MODE") return "DANCE_ACTIVE";
  if (state === "ARMING_SEQ") return "MOTOR_TEST_SEQ";
  if (state === "ARMED_IDLE") return "ARMED_20PCT";
  if (state === "AUTO_TAKEOFF") return "CRUISE_HOVER";
  if (state === "IDLE_DISARMED" || state === "DISARMED") return "DISARMED_0PCT";
  return "LINK_NOMINAL";
}

function wrapAngleRad(rad) {
  let a = (rad + Math.PI) % (2.0 * Math.PI);
  if (a < 0) a += 2.0 * Math.PI;
  return a - Math.PI;
}

function stepFlightController50Hz() {
  const nowMs = Date.now();
  const dt = LOOP_DT_MS * 0.001; // 0.02 s
  const elapsedStateMs = nowMs - stateEntryMs;

  // Cálculo global unificado de distancia Dron-Piloto y RSSI en todos los estados
  const dxGlobal = simWorld.pilotX - simWorld.droneX;
  const dyGlobal = simWorld.pilotY - simWorld.droneY;
  const distGlobal = Math.hypot(dxGlobal, dyGlobal);
  const rssiFromDistGlobal = Math.round(-49.0 - 20.0 * Math.log10(Math.max(0.5, distGlobal)));
  if (!cmdInput.rssiOverride) {
    cmdInput.rssi = Math.max(-95, Math.min(-35, rssiFromDistGlobal));
  }

  if (flightState === "EMERGENCY_KILL" || cmdInput.killRequested) {
    motorPwm = [0, 0, 0, 0];
    currentThrottlePwm = 0.0;
    cmdInput.ry = -1.0;
    simWorld.droneVx = 0.0;
    simWorld.droneVy = 0.0;
    imu.pitch_deg = 0.0;
    imu.roll_deg = 0.0;
    emit50HzTelemetry();
    return;
  }

  // En IDLE_DISARMED los 4 motores permanecen en 0 PWM (0%), altitud 0.0m, zoom 1.0x
  if (!cmdInput.armRequested || flightState === "IDLE_DISARMED" || flightState === "DISARMED") {
    flightState = "IDLE_DISARMED";
    motorPwm = [0, 0, 0, 0];
    currentThrottlePwm = 0.0;
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.rx = 0.0;
    cmdInput.ry = -1.0;
    simWorld.droneVx = 0.0;
    simWorld.droneVy = 0.0;
    imu.pitch_deg = 0.0;
    imu.roll_deg = 0.0;
    imu.gz_dps = 0.0;
    imu.az_g = 1.0;
    emit50HzTelemetry();
    return;
  }

  // Secuencia de armado secuencial de motores (250 ms por cada motor M1 -> M2 -> M3 -> M4)
  if (flightState === "ARMING_SEQ") {
    imu.pitch_deg = 0.0;
    imu.roll_deg = 0.0;
    imu.gz_dps = 0.0;
    imu.az_g = 1.0;
    simWorld.droneVx = 0.0;
    simWorld.droneVy = 0.0;
    const testDuty = 280;
    if (elapsedStateMs < 250) {
      motorPwm = [testDuty, 0, 0, 0];
    } else if (elapsedStateMs < 500) {
      motorPwm = [0, testDuty, 0, 0];
    } else if (elapsedStateMs < 750) {
      motorPwm = [0, 0, testDuty, 0];
    } else if (elapsedStateMs < 1000) {
      motorPwm = [0, 0, 0, testDuty];
    } else {
      flightState = "ARMED_IDLE";
      stateEntryMs = nowMs;
      currentThrottlePwm = 205.0; // 20% PWM
      motorPwm = [205, 205, 205, 205];
    }
    emit50HzTelemetry();
    return;
  }

  // Protección Activa de Cobertura Wi-Fi: si está en vuelo y RSSI <= -75 dBm (d >= 10 m), acercar automáticamente al piloto
  const isAirborneForWifiGuard = (
    flightState === "MANUAL_FLIGHT" ||
    flightState === "WARN_RANGE" ||
    flightState === "AUTO_BRAKE" ||
    flightState === "AUTO_TAKEOFF" ||
    flightState === "PATROL_360" ||
    flightState === "DANCE_MODE"
  );
  if (isAirborneForWifiGuard && cmdInput.rssi <= -75) {
    flightState = "FOLLOW_ME";
    autoReturnWifiActive = true;
    stateEntryMs = nowMs;
    if (currentThrottlePwm < 593.0) currentThrottlePwm = 593.0;
    emitVoiceAnnouncement(VOICE_RESPONSES.ALERT_WIFI_RETURN);
  }

  // Watchdog de pérdida de paquetes únicamente si un controlador externo dejó de transmitir en vuelo manual
  const isAutonomousActive = (
    flightState === "ARMED_IDLE" ||
    flightState === "AUTO_TAKEOFF" ||
    flightState === "FOLLOW_ME" ||
    flightState === "PATROL_360" ||
    flightState === "DANCE_MODE" ||
    flightState === "FAILSAFE_LANDING"
  );

  const heartbeatExpired = hasActiveController && !isAutonomousActive && ((nowMs - lastControllerPacketMs) > HEARTBEAT_TIMEOUT_MS);
  if (heartbeatExpired && flightState !== "IDLE_DISARMED" && flightState !== "DISARMED") {
    if (flightState !== "FAILSAFE_LANDING") {
      flightState = "FAILSAFE_LANDING";
      failsafeStartMs = nowMs;
      inTouchdownWindow = false;
      inGlitchWindow = false;
      const thrNorm = Math.max(0.0, Math.min(1.0, (cmdInput.ry + 1.0) * 0.5));
      failsafeEntryPwm = Math.max(205.0, currentThrottlePwm || (110.0 + thrNorm * 790.0));
      failsafeEntryRy = cmdInput.ry;
      emitVoiceAnnouncement(VOICE_RESPONSES.CMD_LAND);
    }
  }

  let setpointPitchDeg = 0.0;
  let setpointRollDeg = 0.0;
  let setpointYawDps = 0.0;
  let baseThrottlePwm = 205.0;

  if (flightState === "FAILSAFE_LANDING") {
    // Aterrizaje completo hasta 0% PWM y 0.0 m en ~2.5 segundos con apagado total
    setpointPitchDeg = 0.0;
    setpointRollDeg = 0.0;
    setpointYawDps = 0.0;
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.rx = 0.0;
    simWorld.droneVx *= 0.85;
    simWorld.droneVy *= 0.85;

    const elapsedSec = (nowMs - failsafeStartMs) * 0.001;
    const progress = Math.min(1.0, elapsedSec / 2.5);
    baseThrottlePwm = Math.max(0.0, failsafeEntryPwm * (1.0 - progress));
    currentThrottlePwm = baseThrottlePwm;

    cmdInput.ry = -1.0 + (failsafeEntryRy + 1.0) * (1.0 - progress);
    imu.az_g = progress < 0.85 ? 0.96 : 1.00;

    if (progress >= 1.0 || baseThrottlePwm <= 12.0) {
      cmdInput.armRequested = false;
      hasActiveController = false;
      autoReturnWifiActive = false;
      flightState = "IDLE_DISARMED";
      currentThrottlePwm = 0.0;
      cmdInput.ry = -1.0;
      imu.pitch_deg = 0.0;
      imu.roll_deg = 0.0;
      imu.gz_dps = 0.0;
      imu.az_g = 1.0;
      motorPwm = [0, 0, 0, 0];
      emitVoiceAnnouncement(VOICE_RESPONSES.CMD_LAND_DONE);
      emit50HzTelemetry();
      return;
    }
  } else if (flightState === "ARMED_IDLE") {
    // 4 motores armados al 20% PWM (205 / 1023) con PID nivelado en 0°
    setpointPitchDeg = 0.0;
    setpointRollDeg = 0.0;
    setpointYawDps = 0.0;
    currentThrottlePwm = 205.0;
    baseThrottlePwm = 205.0;
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.rx = 0.0;
    cmdInput.ry = -0.60;
    simWorld.droneVx = 0.0;
    simWorld.droneVy = 0.0;
    imu.az_g = 1.0;
  } else if (flightState === "AUTO_TAKEOFF") {
    // Rampa suave de aceleración (Throttle) hasta 58% PWM (593 / 1023 -> Zoom 1.6x)
    const targetTakeoffPwm = 593.0;
    currentThrottlePwm += (targetTakeoffPwm - currentThrottlePwm) * Math.min(1.0, dt * 2.8);
    baseThrottlePwm = currentThrottlePwm;
    setpointPitchDeg = 0.0;
    setpointRollDeg = 0.0;
    setpointYawDps = 0.0;
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.rx = 0.0;
    cmdInput.ry = 0.10; // Corresponde a Zoom 1.60x en el simulador
    simWorld.droneVx *= 0.85;
    simWorld.droneVy *= 0.85;
    imu.az_g = Math.abs(targetTakeoffPwm - currentThrottlePwm) > 18.0 ? 1.16 : 1.00;
  } else if (flightState === "FOLLOW_ME") {
    // Vector exacto entre el Dron y el Piloto en coordenadas de mundo (metros): apunta de Dron -> Piloto
    const dx = simWorld.pilotX - simWorld.droneX;
    const dy = simWorld.pilotY - simWorld.droneY;
    const distM = Math.hypot(dx, dy);

    // Orientar la nariz del dron (Yaw) directamente hacia el piloto
    if (distM > 0.15) {
      const targetHeadingRad = Math.atan2(dx, dy);
      const headingErrRad = wrapAngleRad(targetHeadingRad - simWorld.headingRad);
      setpointYawDps = Math.max(-110.0, Math.min(110.0, (headingErrRad * 180.0 / Math.PI) * 2.4));
      cmdInput.rx = Math.max(-1.0, Math.min(1.0, setpointYawDps / 120.0));
    } else {
      setpointYawDps = 0.0;
      cmdInput.rx = 0.0;
    }

    // Persecución vectorial directa en coordenadas del mundo hacia el anillo seguro de 2.0 m (-55 dBm)
    const targetDistM = 2.0;
    const ux = distM > 0.01 ? (dx / distM) : 0.0;
    const uy = distM > 0.01 ? (dy / distM) : 0.0;

    let desiredSpeed = 0.0;
    if (distM > 2.05) {
      // Acercarse directamente hacia (pilotX, pilotY)
      desiredSpeed = Math.min(3.8, (distM - targetDistM) * 1.45);
    } else if (distM < 1.20) {
      // Si está demasiado cerca (< 1.2 m), separarse suavemente hacia el anillo de 2.0 m
      desiredSpeed = -Math.min(1.8, (targetDistM - distM) * 1.25);
    } else {
      // Dentro de la corona segura (1.2 m .. 2.05 m), converger suavemente a 2.0 m
      desiredSpeed = (distM - targetDistM) * 0.65;
      if (autoReturnWifiActive && distM <= 2.2) {
        autoReturnWifiActive = false;
      }
    }

    const targetVx = ux * desiredSpeed;
    const targetVy = uy * desiredSpeed;
    simWorld.droneVx += (targetVx - simWorld.droneVx) * Math.min(1.0, dt * 6.5);
    simWorld.droneVy += (targetVy - simWorld.droneVy) * Math.min(1.0, dt * 6.5);

    // Calcular inclinación Pitch/Roll coherente con el vector de velocidad en el marco del dron
    const cosH = Math.cos(simWorld.headingRad);
    const sinH = Math.sin(simWorld.headingRad);
    const fwdSpeed = simWorld.droneVx * sinH + simWorld.droneVy * cosH;
    const rightSpeed = simWorld.droneVx * cosH - simWorld.droneVy * sinH;

    setpointPitchDeg = Math.max(-18.0, Math.min(18.0, fwdSpeed * 4.5));
    setpointRollDeg  = Math.max(-16.0, Math.min(16.0, rightSpeed * 4.5));

    cmdInput.ly = Math.max(-1.0, Math.min(1.0, setpointPitchDeg / 22.0));
    cmdInput.lx = Math.max(-1.0, Math.min(1.0, setpointRollDeg  / 22.0));
    cmdInput.ry = 0.10;
    currentThrottlePwm = 593.0;
    baseThrottlePwm = 593.0;
    imu.az_g = 1.02;
  } else if (flightState === "PATROL_360") {
    // Barrido perimetral de 360° manteniendo altitud fija y diferencial PWM en las diagonales
    setpointPitchDeg = 0.0;
    setpointRollDeg = 0.0;
    setpointYawDps = 48.0; // Rotación continua suave en Yaw
    cmdInput.lx = 0.0;
    cmdInput.ly = 0.0;
    cmdInput.rx = 0.40;
    cmdInput.ry = 0.10;
    simWorld.droneVx *= 0.85;
    simWorld.droneVy *= 0.85;
    currentThrottlePwm = 593.0;
    baseThrottlePwm = 593.0;
    imu.az_g = 1.00;
  } else if (flightState === "DANCE_MODE") {
    // Coreografía rítmica continua en posición segura: Roll ±18°, Pitch ±14°, giros Yaw y pulsos de sustentación
    const tSec = elapsedStateMs * 0.001;
    setpointRollDeg  = 18.0 * Math.sin(tSec * 5.5);
    setpointPitchDeg = 14.0 * Math.cos(tSec * 4.2);
    setpointYawDps   = 75.0 * Math.sin(tSec * 2.8);
    baseThrottlePwm  = 593.0 + 75.0 * Math.sin(tSec * 6.0);
    currentThrottlePwm = baseThrottlePwm;

    cmdInput.lx = Math.max(-1.0, Math.min(1.0, setpointRollDeg / 22.0));
    cmdInput.ly = Math.max(-1.0, Math.min(1.0, setpointPitchDeg / 22.0));
    cmdInput.rx = Math.max(-1.0, Math.min(1.0, setpointYawDps / 120.0));
    cmdInput.ry = 0.10 + 0.12 * Math.sin(tSec * 6.0);
    imu.az_g = 1.0 + 0.18 * Math.sin(tSec * 6.0);

    // Mantener el dron bailando sobre su posición segura sin alejarse del piloto
    simWorld.droneVx = Math.cos(tSec * 4.2) * 0.35;
    simWorld.droneVy = Math.sin(tSec * 5.5) * 0.35;
  } else {
    // Vuelo Manual (MANUAL_FLIGHT / NOMINAL_FLIGHT / WARN_RANGE / AUTO_BRAKE)
    const maxTiltDeg = 22.0;
    const userPitchDeg = cmdInput.ly * maxTiltDeg;
    const userRollDeg = cmdInput.lx * maxTiltDeg;

    if (cmdInput.rssi >= -82 && (Math.abs(userPitchDeg) > 1.5 || Math.abs(userRollDeg) > 1.5)) {
      lastValidPitchDeg = userPitchDeg;
      lastValidRollDeg = userRollDeg;
    }

    if (cmdInput.rssi < -82) {
      if (!autoBrakeLock) {
        autoBrakeLock = true;
        autoBrakeStartMs = nowMs;
        emitVoiceAnnouncement(VOICE_RESPONSES.ALERT_BRAKE);
      }
      flightState = "AUTO_BRAKE";
    } else if (autoBrakeLock && (nowMs - autoBrakeStartMs) < AUTO_BRAKE_MS) {
      flightState = "AUTO_BRAKE";
    } else {
      autoBrakeLock = false;
      flightState = cmdInput.rssi < -75 ? "WARN_RANGE" : "MANUAL_FLIGHT";
    }

    if (flightState === "AUTO_BRAKE") {
      if ((nowMs - autoBrakeStartMs) <= AUTO_BRAKE_MS) {
        setpointPitchDeg = Math.max(-18.0, Math.min(18.0, -lastValidPitchDeg * 0.85));
        setpointRollDeg  = Math.max(-18.0, Math.min(18.0, -lastValidRollDeg * 0.85));
        cmdInput.ly = setpointPitchDeg / maxTiltDeg;
        cmdInput.lx = setpointRollDeg / maxTiltDeg;
      } else {
        setpointPitchDeg = 0.0;
        setpointRollDeg = 0.0;
        cmdInput.lx = 0.0;
        cmdInput.ly = 0.0;
      }
      setpointYawDps = 0.0;
    } else {
      setpointPitchDeg = userPitchDeg;
      setpointRollDeg = userRollDeg;
      setpointYawDps = cmdInput.rx * 120.0;
    }

    const thrNorm = Math.max(0.0, Math.min(1.0, (cmdInput.ry + 1.0) * 0.5));
    baseThrottlePwm = 110.0 + thrNorm * 790.0;
    currentThrottlePwm = baseThrottlePwm;
  }

  const nextPitch = imu.pitch_deg + (setpointPitchDeg - imu.pitch_deg) * 0.28;
  const nextRoll  = imu.roll_deg  + (setpointRollDeg  - imu.roll_deg)  * 0.28;
  imu.gy_dps = (nextPitch - imu.pitch_deg) / dt;
  imu.gx_dps = (nextRoll  - imu.roll_deg)  / dt;
  imu.gz_dps = setpointYawDps;
  imu.pitch_deg = nextPitch;
  imu.roll_deg  = nextRoll;
  imu.yaw_deg   = (imu.yaw_deg + imu.gz_dps * dt) % 360.0;

  // Integración cinemática 2D del dron en el servidor para seguimiento autónomo sincronizado
  const isFlying = (
    flightState !== "IDLE_DISARMED" &&
    flightState !== "DISARMED" &&
    flightState !== "EMERGENCY_KILL" &&
    flightState !== "ARMING_SEQ" &&
    flightState !== "ARMED_IDLE"
  );

  if (isFlying) {
    const yawRateRad = (flightState === "FOLLOW_ME" || flightState === "PATROL_360" || flightState === "DANCE_MODE")
      ? (imu.gz_dps * Math.PI / 180.0)
      : ((cmdInput.lx * 1.45) + (cmdInput.rx * 1.15));
    simWorld.headingRad = wrapAngleRad(simWorld.headingRad + yawRateRad * dt);

    if (flightState !== "FOLLOW_ME" && flightState !== "DANCE_MODE" && flightState !== "FAILSAFE_LANDING") {
      const forwardAccel = (imu.pitch_deg / 22.0) * 14.0;
      const lateralAccel = (imu.roll_deg  / 22.0) * 9.5;
      const cosH = Math.cos(simWorld.headingRad);
      const sinH = Math.sin(simWorld.headingRad);

      const axWorld = (sinH * forwardAccel) + (cosH * lateralAccel);
      const ayWorld = (cosH * forwardAccel) - (sinH * lateralAccel);

      simWorld.droneVx += axWorld * dt;
      simWorld.droneVy += ayWorld * dt;

      const drag = Math.pow(0.18, dt);
      simWorld.droneVx *= drag;
      simWorld.droneVy *= drag;
    }

    simWorld.droneX += simWorld.droneVx * dt;
    simWorld.droneY += simWorld.droneVy * dt;
  }

  const uPitch = pidPitch.compute(setpointPitchDeg, imu.pitch_deg, dt);
  const uRoll  = pidRoll.compute(setpointRollDeg, imu.roll_deg, dt);
  const uYaw   = pidYaw.compute(setpointYawDps, imu.gz_dps, dt);

  const minArmedPwm = flightState === "FAILSAFE_LANDING" ? 0 : 110;
  const clampPwm = (val) => Math.round(Math.max(minArmedPwm, Math.min(1023, val)));
  motorPwm[0] = clampPwm(baseThrottlePwm - uPitch + uRoll - uYaw);
  motorPwm[1] = clampPwm(baseThrottlePwm - uPitch - uRoll + uYaw);
  motorPwm[2] = clampPwm(baseThrottlePwm + uPitch + uRoll + uYaw);
  motorPwm[3] = clampPwm(baseThrottlePwm + uPitch - uRoll - uYaw);

  emit50HzTelemetry();
}

function emit50HzTelemetry() {
  const payload = JSON.stringify({
    lx: Number(cmdInput.lx.toFixed(3)),
    ly: Number(cmdInput.ly.toFixed(3)),
    rx: Number(cmdInput.rx.toFixed(3)),
    ry: Number(cmdInput.ry.toFixed(3)),
    rssi: cmdInput.rssi,
    state: flightState,
    flag: getTelemetryFlag(flightState),
    pitch: Number(imu.pitch_deg.toFixed(2)),
    roll: Number(imu.roll_deg.toFixed(2)),
    yaw: Number(imu.yaw_deg.toFixed(2)),
    az: Number(imu.az_g.toFixed(3)),
    vbat: Number(batteryVoltage.toFixed(2)),
    m1: motorPwm[0],
    m2: motorPwm[1],
    m3: motorPwm[2],
    m4: motorPwm[3],
    px: Number(simWorld.pilotX.toFixed(2)),
    py: Number(simWorld.pilotY.toFixed(2)),
    dx: Number(simWorld.droneX.toFixed(2)),
    dy: Number(simWorld.droneY.toFixed(2)),
    heading: Number(simWorld.headingRad.toFixed(4)),
    voice_msg: lastVoiceMsg,
    voice_seq: lastVoiceSeq
  });

  broadcastJsonFrame(payload);
}

setInterval(stepFlightController50Hz, LOOP_DT_MS);

// ============================================================================
// 4. SERVIDOR HTTP WI-FI EN PUERTO 8080 (INCLUYENDO /apk Y /uav-control.apk)
// ============================================================================
function serveApkPackage(res) {
  const resolvedApkPath = fs.existsSync(APK_RELEASE_PATH)
    ? APK_RELEASE_PATH
    : (fs.existsSync(APK_WWW_PATH)
      ? APK_WWW_PATH
      : (fs.existsSync(APK_GRADLE_FALLBACK) ? APK_GRADLE_FALLBACK : null));

  if (!resolvedApkPath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("El paquete APK aún no ha sido generado. Ejecute .\\scripts\\compilar-apks.ps1 primero.");
    return;
  }

  fs.stat(resolvedApkPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Error al leer uav-control.apk");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="uav-control.apk"',
      "Content-Length": stats.size,
      "Cache-Control": "no-store"
    });

    const stream = fs.createReadStream(resolvedApkPath);
    stream.pipe(res);
  });
}

function serveStaticFile(res, absolutePath) {
  fs.readFile(absolutePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Archivo no encontrado");
      return;
    }
    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
}

const httpServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === "/api/info") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      preferredIp: PREFERRED_WIFI_IP,
      ips: getLocalIPv4Addresses(),
      httpPort: HTTP_PORT,
      wsPort: WS_PORT
    }));
    return;
  }

  // Descarga directa del paquete instalable Android (.apk) por Wi-Fi
  if (pathname === "/apk" || pathname === "/uav-control.apk") {
    serveApkPackage(res);
    return;
  }

  // Rutas del Simulador 2D en portátil
  if (pathname === "/simulador" || pathname === "/simulador/" || pathname === "/simulador-pc" || pathname === "/simulador-pc/index.html") {
    serveStaticFile(res, path.join(SIM_DIR, "index.html"));
    return;
  }

  // Rutas de la App Móvil Android GCS
  let relativeFile = pathname === "/" || pathname === "/app" || pathname === "/app/"
    ? "index.html"
    : pathname.replace(/^\/+(app-android\/www\/|app-android\/|app\/)?/, "");

  const safePath = path.normalize(path.join(APP_WWW_DIR, relativeFile));
  if (!safePath.startsWith(APP_WWW_DIR)) {
    res.writeHead(403);
    res.end("Acceso denegado");
    return;
  }

  serveStaticFile(res, safePath);
});

httpServer.on("upgrade", (req, socket) => {
  handleWebSocketUpgrade(req, socket);
});

const wsServer81 = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("UDES UAV WebSocket Server Activo (Puerto 81 @ 50 Hz)");
});

wsServer81.on("upgrade", (req, socket) => {
  handleWebSocketUpgrade(req, socket);
});

httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
  const ips = getLocalIPv4Addresses();
  console.log("======================================================================");
  console.log(" UDES UAV — SERVIDOR WI-FI, DESCARGA APK Y EMULADOR ESP32 (50 Hz)");
  console.log(` IP Principal Detectada: ${PREFERRED_WIFI_IP}`);
  console.log("======================================================================");
  ips.forEach((ip) => {
    console.log(` -> App Móvil Android (Navegador) : http://${ip}:${HTTP_PORT}`);
    console.log(` -> Descarga Directa APK Android  : http://${ip}:${HTTP_PORT}/uav-control.apk (o /apk)`);
    console.log(` -> Simulador 2D en Portátil      : http://${ip}:${HTTP_PORT}/simulador`);
    console.log(` -> Endpoint WebSocket (50 Hz)    : ws://${ip}:${WS_PORT}`);
    console.log("----------------------------------------------------------------------");
  });
});

wsServer81.listen(WS_PORT, "0.0.0.0", () => {
  console.log(` [OK] Servidor WebSocket RFC 6455 escuchando en 0.0.0.0:${WS_PORT} (IP: ${PREFERRED_WIFI_IP}:${WS_PORT})`);
});
