/**
 * @file dron_oficial_mpu6050.ino
 * @brief Firmware 2 — Control de Vuelo Real ESP32 + MPU-6050 + PID + WebSocket RFC6455
 *        - Cero librerias externas (solo <WiFi.h>, <Wire.h>, <mbedtls/sha1.h>, <mbedtls/base64.h>)
 *        - Sin HTML en PROGMEM
 *        - Compatible con ESP32 Arduino Core 2.x y Core 3.x
 *        - Red Wi-Fi AP: "UDES_UAV_CONTROL" | Clave: "12345678" | Canal 1 | IP: 192.168.4.1 | WS: 81
 */

#include <WiFi.h>
#include <Wire.h>
#include <math.h>
#include <mbedtls/version.h>
#include <mbedtls/sha1.h>
#include <mbedtls/base64.h>

// ============================================================================
// ORIENTACION EDITABLE DEL SENSOR MPU-6050 (Ajustar si la placa va rotada)
// ============================================================================
static const bool  SWAP_PITCH_ROLL = false;
static const float SIGN_PITCH      = 1.0f;
static const float SIGN_ROLL       = 1.0f;
static const float SIGN_YAW        = 1.0f;

// ============================================================================
// HARDWARE DEFINITIVO: MOTORES IRFZ44N + MPU-6050 I2C
// ============================================================================
static const uint8_t MOTOR_PINS[4] = {
  25, // M1_FL: Delantero Izquierdo (CW)
  26, // M2_FR: Delantero Derecho   (CCW)
  27, // M3_RL: Trasero Izquierdo   (CCW)
  14  // M4_RR: Trasero Derecho     (CW)
};

static const uint32_t PWM_FREQ = 2500;
static const uint8_t  PWM_RES  = 10;
static const uint16_t PWM_MAX  = 1023;

static const int     I2C_SDA   = 21;
static const int     I2C_SCL   = 22;
static const uint8_t MPU_ADDR  = 0x68;

// Red Wi-Fi AP Oficial
static const char* AP_SSID = "UDES_UAV_CONTROL";
static const char* AP_PASS = "12345678";
static const IPAddress LOCAL_IP(192, 168, 4, 1);
static const IPAddress GATEWAY(192, 168, 4, 1);
static const IPAddress SUBNET(255, 255, 255, 0);

// ============================================================================
// PARAMETROS DE CONTROL, PID Y SEGURIDAD
// ============================================================================
static const uint32_t LOOP_PERIOD_US       = 10000UL; // 100 Hz (10 ms)
static const float    LOOP_DT_SEC          = 0.01f;
static const uint32_t TELEM_PERIOD_MS      = 30UL;    // ~33 Hz
static const uint32_t FAILSAFE_TIMEOUT_MS  = 600UL;
static const uint32_t LAND_DURATION_MS     = 3500UL;
static const float    MAX_TILT_DEG         = 20.0f;
static const float    ROLLOVER_CUTOFF_DEG  = 55.0f;
static const float    COMP_ALPHA           = 0.96f;

static const char* WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

enum DroneState : uint8_t {
  ST_DISARMED = 0,
  ST_ARMED_READY,
  ST_FLIGHT_STABILIZED,
  ST_FLIGHT_DIRECT,
  ST_DANCING,
  ST_FAILSAFE_LANDING,
  ST_EMERGENCY_STOP
};

enum FlightMode : uint8_t {
  FMODE_STAB = 0,
  FMODE_DIRECT
};

// Estado de vuelo
DroneState droneState = ST_DISARMED;
FlightMode flightMode = FMODE_STAB;
bool       imuHwOk    = false;

// Referencias de mando [-1..1] y acelerador [0..100]
float cmdThr   = 0.0f;
float cmdPitch = 0.0f;
float cmdRoll  = 0.0f;
float cmdYaw   = 0.0f;

// Baile
bool    danceUseDirectPwm  = false;
uint8_t danceDirectPct[4]  = {0, 0, 0, 0};

// Rampa de aterrizaje / failsafe y test de motores
uint32_t landStartMs      = 0;
float    landStartThr     = 0.0f;
bool     motorTestActive  = false;
uint32_t motorTestStartMs = 0;

// Motores actuales [0..100%]
uint8_t motorPct[4] = {0, 0, 0, 0};

// IMU y calibracion
float pitchDeg      = 0.0f;
float rollDeg       = 0.0f;
float yawDeg        = 0.0f;
float gyroPitchRate = 0.0f;
float gyroRollRate  = 0.0f;
float gyroYawRate   = 0.0f;

float gxOff = 0.0f, gyOff = 0.0f, gzOff = 0.0f;
float accPitchOff = 0.0f, accRollOff = 0.0f;

// PID y Trim
float pidKp = 3.00f;
float pidKi = 0.08f;
float pidKd = 0.85f;
float trimPitch = 0.0f;
float trimRoll  = 0.0f;
float iPitch    = 0.0f;
float iRoll     = 0.0f;

uint32_t lastPacketMs = 0;
uint32_t lastTelemMs  = 0;
uint32_t lastLoopUs   = 0;
String   statusMsg    = "Sistema listo";

// ============================================================================
// SERVIDOR WEBSOCKET RFC6455 NATIVO EN PUERTO 81 (MAX 3 CLIENTES)
// ============================================================================
static const uint8_t MAX_WS_CLIENTS = 3;
static const size_t  WS_RX_BUF_CAP  = 768;

enum WsClientStage : uint8_t {
  WS_EMPTY = 0,
  WS_HANDSHAKE,
  WS_OPEN
};

struct WsClientSlot {
  WiFiClient    sock;
  WsClientStage stage;
  String        httpHeader;
  uint8_t       rxBuf[WS_RX_BUF_CAP];
  size_t        rxLen;
  uint32_t      connectedMs;
};

WiFiServer   wsServer(81);
WsClientSlot wsClients[MAX_WS_CLIENTS];

// ============================================================================
// HELPERS DE UTILIDAD Y COMPATIBILIDAD CORE 2.x / 3.x
// ============================================================================
float clampf(float v, float lo, float hi) {
  return (v < lo) ? lo : ((v > hi) ? hi : v);
}

void computeSha1(const uint8_t* input, size_t len, uint8_t output[20]) {
  #if defined(MBEDTLS_VERSION_MAJOR) && (MBEDTLS_VERSION_MAJOR >= 3)
    mbedtls_sha1(input, len, output);
  #else
    mbedtls_sha1_ret(input, len, output);
  #endif
}

void writeMotorPwmRaw(uint8_t idx, uint16_t pwm) {
  if (idx >= 4) return;
  if (pwm > PWM_MAX) pwm = PWM_MAX;
  motorPct[idx] = (uint8_t)((pwm * 100UL + (PWM_MAX / 2U)) / PWM_MAX);

  #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
    ledcWrite(MOTOR_PINS[idx], pwm);
  #else
    ledcWrite(idx, pwm);
  #endif
}

void writeAllMotorsZero() {
  for (uint8_t i = 0; i < 4; i++) {
    writeMotorPwmRaw(i, 0);
  }
}

void resetPidIntegrators() {
  iPitch = 0.0f;
  iRoll  = 0.0f;
}

bool isArmedOrActive() {
  return droneState == ST_ARMED_READY ||
         droneState == ST_FLIGHT_STABILIZED ||
         droneState == ST_FLIGHT_DIRECT ||
         droneState == ST_DANCING ||
         droneState == ST_FAILSAFE_LANDING;
}

const char* stateToStr(DroneState st) {
  switch (st) {
    case ST_DISARMED:          return "DISARMED";
    case ST_ARMED_READY:       return "ARMED_READY";
    case ST_FLIGHT_STABILIZED: return "FLIGHT_STABILIZED";
    case ST_FLIGHT_DIRECT:     return "FLIGHT_DIRECT";
    case ST_DANCING:           return "DANCING";
    case ST_FAILSAFE_LANDING:  return "FAILSAFE_LANDING";
    case ST_EMERGENCY_STOP:    return "EMERGENCY_STOP";
    default:                   return "DISARMED";
  }
}

const char* activeFlightModeStr() {
  return (flightMode == FMODE_STAB && imuHwOk) ? "STAB" : "DIRECT";
}

// ============================================================================
// MPU-6050 POR I2C SIN LIBRERIAS EXTERNAS
// ============================================================================
bool mpuWriteReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  return Wire.endTransmission() == 0;
}

bool mpuReadBytes(uint8_t startReg, uint8_t count, uint8_t* dst) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(startReg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  uint8_t got = Wire.requestFrom((int)MPU_ADDR, (int)count, (int)true);
  if (got != count) {
    return false;
  }
  for (uint8_t i = 0; i < count; i++) {
    dst[i] = Wire.read();
  }
  return true;
}

bool readMpuScaled(float& outAx, float& outAy, float& outAz, float& outGx, float& outGy, float& outGz) {
  uint8_t raw[14];
  if (!mpuReadBytes(0x3B, 14, raw)) {
    return false;
  }

  int16_t rawAx = (int16_t)((raw[0] << 8) | raw[1]);
  int16_t rawAy = (int16_t)((raw[2] << 8) | raw[3]);
  int16_t rawAz = (int16_t)((raw[4] << 8) | raw[5]);
  int16_t rawGx = (int16_t)((raw[8] << 8) | raw[9]);
  int16_t rawGy = (int16_t)((raw[10] << 8) | raw[11]);
  int16_t rawGz = (int16_t)((raw[12] << 8) | raw[13]);

  // Escala +/-4g (8192 LSB/g) y +/-500 deg/s (65.5 LSB/(deg/s))
  float ax = (float)rawAx / 8192.0f;
  float ay = (float)rawAy / 8192.0f;
  float az = (float)rawAz / 8192.0f;
  float gx = (float)rawGx / 65.5f;
  float gy = (float)rawGy / 65.5f;
  float gz = (float)rawGz / 65.5f;

  if (SWAP_PITCH_ROLL) {
    outAx = ay; outAy = ax; outAz = az;
    outGx = gy; outGy = gx; outGz = gz;
  } else {
    outAx = ax; outAy = ay; outAz = az;
    outGx = gx; outGy = gy; outGz = gz;
  }
  return true;
}

bool calibrateImuInternal() {
  if (!imuHwOk) return false;
  if (isArmedOrActive()) return false;

  writeAllMotorsZero();
  double sumGx = 0.0, sumGy = 0.0, sumGz = 0.0;
  double sumAccP = 0.0, sumAccR = 0.0;
  int valid = 0;

  for (int i = 0; i < 200; i++) {
    float ax, ay, az, gx, gy, gz;
    if (readMpuScaled(ax, ay, az, gx, gy, gz)) {
      float ap = atan2f(ax, sqrtf(ay * ay + az * az)) * RAD_TO_DEG * SIGN_PITCH;
      float ar = atan2f(ay, sqrtf(ax * ax + az * az)) * RAD_TO_DEG * SIGN_ROLL;
      sumGx += gx;
      sumGy += gy;
      sumGz += gz;
      sumAccP += ap;
      sumAccR += ar;
      valid++;
    }
    delay(4);
  }

  if (valid < 50) {
    return false;
  }

  gxOff = (float)(sumGx / valid);
  gyOff = (float)(sumGy / valid);
  gzOff = (float)(sumGz / valid);
  accPitchOff = (float)(sumAccP / valid);
  accRollOff  = (float)(sumAccR / valid);

  pitchDeg = 0.0f;
  rollDeg  = 0.0f;
  yawDeg   = 0.0f;
  resetPidIntegrators();
  return true;
}

void initMpu6050() {
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);
  Wire.setTimeOut(15);

  uint8_t who = 0;
  if (!mpuWriteReg(0x6B, 0x00)) {
    imuHwOk = false;
    flightMode = FMODE_DIRECT;
    statusMsg = "Sin MPU-6050: modo DIRECTO activo";
    return;
  }
  delay(20);
  mpuWriteReg(0x19, 0x09); // 100 Hz
  mpuWriteReg(0x1A, 0x03); // DLPF ~44 Hz
  mpuWriteReg(0x1B, 0x08); // +/- 500 deg/s
  mpuWriteReg(0x1C, 0x08); // +/- 4 g

  if (!mpuReadBytes(0x75, 1, &who) || (who != 0x68 && who != 0x70 && who != 0x72 && who != 0x98)) {
    imuHwOk = false;
    flightMode = FMODE_DIRECT;
    statusMsg = "MPU-6050 no detectado: modo DIRECTO";
    return;
  }

  imuHwOk = true;
  flightMode = FMODE_STAB;
  if (calibrateImuInternal()) {
    statusMsg = "MPU-6050 OK y calibrado";
  } else {
    statusMsg = "MPU-6050 OK (calibracion parcial)";
  }
}

void updateImuStep() {
  if (!imuHwOk) return;

  float ax, ay, az, gx, gy, gz;
  if (!readMpuScaled(ax, ay, az, gx, gy, gz)) {
    return;
  }

  // Tasas angulares calibradas (deg/s)
  gyroPitchRate = -(gy - gyOff) * SIGN_PITCH;
  gyroRollRate  =  (gx - gxOff) * SIGN_ROLL;
  gyroYawRate   =  (gz - gzOff) * SIGN_YAW;

  float accPitch = (atan2f(ax, sqrtf(ay * ay + az * az)) * RAD_TO_DEG * SIGN_PITCH) - accPitchOff;
  float accRoll  = (atan2f(ay, sqrtf(ax * ax + az * az)) * RAD_TO_DEG * SIGN_ROLL)  - accRollOff;

  pitchDeg = COMP_ALPHA * (pitchDeg + gyroPitchRate * LOOP_DT_SEC) + (1.0f - COMP_ALPHA) * accPitch;
  rollDeg  = COMP_ALPHA * (rollDeg  + gyroRollRate  * LOOP_DT_SEC) + (1.0f - COMP_ALPHA) * accRoll;
  yawDeg  += gyroYawRate * LOOP_DT_SEC;
  if (yawDeg > 180.0f) yawDeg -= 360.0f;
  if (yawDeg < -180.0f) yawDeg += 360.0f;
}

// ============================================================================
// PARSEADOR JSON LIGERO SIN LIBRERIAS EXTERNAS
// ============================================================================
int findJsonKeyPos(const String& json, const char* key) {
  String needle = String("\"") + key + "\"";
  int pos = json.indexOf(needle);
  if (pos < 0) return -1;
  int colon = json.indexOf(':', pos + needle.length());
  if (colon < 0) return -1;
  colon++;
  while (colon < (int)json.length() && (json[colon] == ' ' || json[colon] == '\t')) {
    colon++;
  }
  return colon;
}

bool jsonHasKey(const String& json, const char* key) {
  return findJsonKeyPos(json, key) >= 0;
}

bool jsonGetString(const String& json, const char* key, String& out) {
  int pos = findJsonKeyPos(json, key);
  if (pos < 0 || pos >= (int)json.length() || json[pos] != '"') return false;
  int end = json.indexOf('"', pos + 1);
  if (end < 0) return false;
  out = json.substring(pos + 1, end);
  return true;
}

bool jsonGetFloat(const String& json, const char* key, float& out) {
  int pos = findJsonKeyPos(json, key);
  if (pos < 0 || pos >= (int)json.length()) return false;
  int end = pos;
  while (end < (int)json.length()) {
    char c = json[end];
    if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.') {
      end++;
    } else {
      break;
    }
  }
  if (end == pos) return false;
  out = json.substring(pos, end).toFloat();
  return true;
}

bool jsonGetInt(const String& json, const char* key, int& out) {
  float f = 0.0f;
  if (!jsonGetFloat(json, key, f)) return false;
  out = (int)lroundf(f);
  return true;
}

// ============================================================================
// TRANSICIONES DE SEGURIDAD Y COMANDOS JSON
// ============================================================================
void triggerEmergencyStop(const char* reason) {
  motorTestActive = false;
  danceUseDirectPwm = false;
  cmdThr = 0.0f;
  cmdPitch = 0.0f;
  cmdRoll = 0.0f;
  cmdYaw = 0.0f;
  resetPidIntegrators();
  writeAllMotorsZero();
  droneState = ST_EMERGENCY_STOP;
  statusMsg = reason;
}

void disarmDrone(const char* reason) {
  motorTestActive = false;
  danceUseDirectPwm = false;
  cmdThr = 0.0f;
  cmdPitch = 0.0f;
  cmdRoll = 0.0f;
  cmdYaw = 0.0f;
  resetPidIntegrators();
  writeAllMotorsZero();
  droneState = ST_DISARMED;
  statusMsg = reason;
}

void startLanding(DroneState targetState, const char* reason) {
  motorTestActive = false;
  danceUseDirectPwm = false;
  cmdPitch = 0.0f;
  cmdRoll = 0.0f;
  cmdYaw = 0.0f;
  landStartMs = millis();
  landStartThr = cmdThr;
  droneState = targetState;
  statusMsg = reason;
}

void handleJsonMessage(const String& json) {
  lastPacketMs = millis();

  int killVal = 0;
  if (jsonGetInt(json, "kill", killVal) && killVal == 1) {
    triggerEmergencyStop("KILL de emergencia activado");
    return;
  }

  String cmd;
  if (jsonGetString(json, "cmd", cmd)) {
    if (cmd == "ARM") {
      if (cmdThr > 5.0f) {
        statusMsg = "Armado bloqueado: baja acelerador <=5%";
        return;
      }
      motorTestActive = false;
      danceUseDirectPwm = false;
      resetPidIntegrators();
      cmdThr = 0.0f;
      cmdPitch = 0.0f;
      cmdRoll = 0.0f;
      cmdYaw = 0.0f;
      droneState = ST_ARMED_READY;
      statusMsg = "Dron armado (listo)";
      return;
    }

    if (cmd == "VOICE_ARM") {
      float targetThr = 40.0f;
      jsonGetFloat(json, "thr", targetThr);
      targetThr = clampf(targetThr, 0.0f, 100.0f);
      motorTestActive = false;
      danceUseDirectPwm = false;
      resetPidIntegrators();
      cmdThr = targetThr;
      cmdPitch = 0.0f;
      cmdRoll = 0.0f;
      cmdYaw = 0.0f;
      if (targetThr > 0.0f) {
        droneState = (flightMode == FMODE_STAB && imuHwOk) ? ST_FLIGHT_STABILIZED : ST_FLIGHT_DIRECT;
      } else {
        droneState = ST_ARMED_READY;
      }
      statusMsg = "Encendido por voz";
      return;
    }

    if (cmd == "DISARM") {
      disarmDrone("Dron desarmado");
      return;
    }

    if (cmd == "CALIBRATE") {
      if (isArmedOrActive()) {
        statusMsg = "Desarma antes de calibrar IMU";
        return;
      }
      if (!imuHwOk) {
        statusMsg = "Sin MPU-6050 para calibrar";
        return;
      }
      if (calibrateImuInternal()) {
        droneState = ST_DISARMED;
        statusMsg = "MPU-6050 calibrado a 0 deg";
      } else {
        statusMsg = "Error calibrando MPU-6050";
      }
      return;
    }

    if (cmd == "MODE_STAB") {
      if (!imuHwOk) {
        flightMode = FMODE_DIRECT;
        statusMsg = "Sin MPU-6050: permanece DIRECTO";
      } else {
        flightMode = FMODE_STAB;
        resetPidIntegrators();
        if (droneState == ST_FLIGHT_DIRECT) {
          droneState = ST_FLIGHT_STABILIZED;
        }
        statusMsg = "Modo ESTABILIZADO (MPU-6050)";
      }
      return;
    }

    if (cmd == "MODE_DIRECT") {
      flightMode = FMODE_DIRECT;
      resetPidIntegrators();
      if (droneState == ST_FLIGHT_STABILIZED) {
        droneState = ST_FLIGHT_DIRECT;
      }
      statusMsg = "Modo DIRECTO (sin PID)";
      return;
    }

    if (cmd == "TEST_MOTORS") {
      if (isArmedOrActive()) {
        statusMsg = "Desarma antes de probar motores";
        return;
      }
      droneState = ST_DISARMED;
      motorTestActive = true;
      motorTestStartMs = millis();
      statusMsg = "Test secuencial M1->M4 (35%)";
      return;
    }

    if (cmd == "LAND_START") {
      if (isArmedOrActive() && cmdThr > 0.0f) {
        startLanding(ST_FAILSAFE_LANDING, "Aterrizaje suave iniciado");
      } else {
        disarmDrone("Aterrizaje completado");
      }
      return;
    }

    if (cmd == "SET_PID") {
      float v = 0.0f;
      if (jsonGetFloat(json, "kp", v)) pidKp = clampf(v, 0.0f, 15.0f);
      if (jsonGetFloat(json, "ki", v)) pidKi = clampf(v, 0.0f, 5.0f);
      if (jsonGetFloat(json, "kd", v)) pidKd = clampf(v, 0.0f, 5.0f);
      statusMsg = "PID actualizado";
      return;
    }

    if (cmd == "SET_TRIM") {
      float v = 0.0f;
      if (jsonGetFloat(json, "tp", v)) trimPitch = clampf(v, -12.0f, 12.0f);
      if (jsonGetFloat(json, "tr", v)) trimRoll  = clampf(v, -12.0f, 12.0f);
      statusMsg = "Trim CG actualizado";
      return;
    }

    if (cmd == "DANCE_STAB") {
      if (droneState == ST_EMERGENCY_STOP) {
        statusMsg = "Emergencia activa: desarma para reiniciar";
        return;
      }
      motorTestActive = false;
      danceUseDirectPwm = false;
      float t = cmdThr, p = 0.0f, r = 0.0f;
      if (jsonGetFloat(json, "thr", t))   cmdThr   = clampf(t, 0.0f, 100.0f);
      if (jsonGetFloat(json, "pitch", p)) cmdPitch = clampf(p, -1.0f, 1.0f);
      if (jsonGetFloat(json, "roll", r))  cmdRoll  = clampf(r, -1.0f, 1.0f);
      cmdYaw = 0.0f;
      droneState = ST_DANCING;
      statusMsg = "Bailando (STAB PID)";
      return;
    }

    if (cmd == "DANCE_PWM") {
      if (droneState == ST_EMERGENCY_STOP) {
        statusMsg = "Emergencia activa: desarma para reiniciar";
        return;
      }
      motorTestActive = false;
      danceUseDirectPwm = true;
      int m1 = 0, m2 = 0, m3 = 0, m4 = 0;
      if (jsonGetInt(json, "m1", m1)) danceDirectPct[0] = (uint8_t)constrain(m1, 0, 100);
      if (jsonGetInt(json, "m2", m2)) danceDirectPct[1] = (uint8_t)constrain(m2, 0, 100);
      if (jsonGetInt(json, "m3", m3)) danceDirectPct[2] = (uint8_t)constrain(m3, 0, 100);
      if (jsonGetInt(json, "m4", m4)) danceDirectPct[3] = (uint8_t)constrain(m4, 0, 100);
      cmdThr = (float)(danceDirectPct[0] + danceDirectPct[1] + danceDirectPct[2] + danceDirectPct[3]) * 0.25f;
      droneState = ST_DANCING;
      statusMsg = "Bailando (DIRECT PWM)";
      return;
    }

    if (cmd == "DANCE_END") {
      float retThr = 0.0f;
      jsonGetFloat(json, "thr", retThr);
      retThr = clampf(retThr, 0.0f, 100.0f);
      danceUseDirectPwm = false;
      cmdPitch = 0.0f;
      cmdRoll  = 0.0f;
      cmdYaw   = 0.0f;
      if (retThr <= 0.0f) {
        disarmDrone("Baile finalizado (0%)");
      } else {
        cmdThr = retThr;
        droneState = (flightMode == FMODE_STAB && imuHwOk) ? ST_FLIGHT_STABILIZED : ST_FLIGHT_DIRECT;
        statusMsg = "Baile finalizado: vuelo restaurado";
      }
      return;
    }
  }

  // Paquete continuo de vuelo: {"thr":0..100, "pitch":-1..1, "roll":-1..1, "yaw":-1..1, "kill":0/1}
  float thrIn = 0.0f, pIn = 0.0f, rIn = 0.0f, yIn = 0.0f;
  bool hasThr   = jsonGetFloat(json, "thr", thrIn);
  bool hasPitch = jsonGetFloat(json, "pitch", pIn);
  bool hasRoll  = jsonGetFloat(json, "roll", rIn);
  bool hasYaw   = jsonGetFloat(json, "yaw", yIn);

  if (hasThr || hasPitch || hasRoll || hasYaw) {
    if (droneState == ST_DANCING || droneState == ST_FAILSAFE_LANDING) {
      return;
    }
    if (hasThr)   cmdThr   = clampf(thrIn, 0.0f, 100.0f);
    if (hasPitch) cmdPitch = clampf(pIn, -1.0f, 1.0f);
    if (hasRoll)  cmdRoll  = clampf(rIn, -1.0f, 1.0f);
    if (hasYaw)   cmdYaw   = clampf(yIn, -1.0f, 1.0f);

    if (droneState == ST_ARMED_READY || droneState == ST_FLIGHT_STABILIZED || droneState == ST_FLIGHT_DIRECT) {
      if (cmdThr > 2.0f) {
        droneState = (flightMode == FMODE_STAB && imuHwOk) ? ST_FLIGHT_STABILIZED : ST_FLIGHT_DIRECT;
      } else {
        droneState = ST_ARMED_READY;
      }
    }
  }
}

// ============================================================================
// WEBSOCKET RFC6455: HANDSHAKE, DECODIFICACION DE TRAMAS Y TELEMETRIA
// ============================================================================
void closeWsSlot(uint8_t idx) {
  if (wsClients[idx].sock) {
    wsClients[idx].sock.stop();
  }
  wsClients[idx].stage = WS_EMPTY;
  wsClients[idx].httpHeader = "";
  wsClients[idx].rxLen = 0;
  wsClients[idx].connectedMs = 0;
}

uint8_t countOpenWsClients() {
  uint8_t cnt = 0;
  for (uint8_t i = 0; i < MAX_WS_CLIENTS; i++) {
    if (wsClients[i].stage == WS_OPEN && wsClients[i].sock.connected()) {
      cnt++;
    }
  }
  return cnt;
}

void sendWsFrame(uint8_t idx, uint8_t opcode, const uint8_t* payload, size_t len) {
  if (wsClients[idx].stage != WS_OPEN || !wsClients[idx].sock.connected()) return;

  uint8_t hdr[4];
  size_t hdrLen = 0;
  hdr[0] = 0x80 | (opcode & 0x0F);
  if (len < 126) {
    hdr[1] = (uint8_t)len;
    hdrLen = 2;
  } else {
    hdr[1] = 126;
    hdr[2] = (uint8_t)((len >> 8) & 0xFF);
    hdr[3] = (uint8_t)(len & 0xFF);
    hdrLen = 4;
  }

  wsClients[idx].sock.write(hdr, hdrLen);
  if (len > 0 && payload != nullptr) {
    wsClients[idx].sock.write(payload, len);
  }
}

bool completeWsHandshake(uint8_t idx) {
  String lower = wsClients[idx].httpHeader;
  lower.toLowerCase();
  int keyIdx = lower.indexOf("sec-websocket-key:");
  if (keyIdx < 0) return false;

  int lineStart = keyIdx + 18;
  int lineEnd = wsClients[idx].httpHeader.indexOf('\n', lineStart);
  if (lineEnd < 0) lineEnd = wsClients[idx].httpHeader.length();
  String key = wsClients[idx].httpHeader.substring(lineStart, lineEnd);
  key.trim();
  if (key.length() == 0) return false;

  String concat = key + WS_GUID;
  uint8_t sha1Out[20];
  computeSha1((const uint8_t*)concat.c_str(), concat.length(), sha1Out);

  unsigned char b64Out[64];
  size_t b64Len = 0;
  if (mbedtls_base64_encode(b64Out, sizeof(b64Out), &b64Len, sha1Out, 20) != 0) {
    return false;
  }
  b64Out[b64Len] = '\0';

  String resp = "HTTP/1.1 101 Switching Protocols\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                "Sec-WebSocket-Accept: " + String((const char*)b64Out) + "\r\n\r\n";

  wsClients[idx].sock.print(resp);
  wsClients[idx].sock.setNoDelay(true);
  wsClients[idx].stage = WS_OPEN;
  wsClients[idx].httpHeader = "";
  wsClients[idx].rxLen = 0;
  lastPacketMs = millis();
  return true;
}

void processWsFrames(uint8_t idx) {
  WsClientSlot& cl = wsClients[idx];
  while (cl.sock.available() > 0 && cl.rxLen < WS_RX_BUF_CAP) {
    int c = cl.sock.read();
    if (c < 0) break;
    cl.rxBuf[cl.rxLen++] = (uint8_t)c;
  }

  while (cl.rxLen >= 2) {
    uint8_t b0 = cl.rxBuf[0];
    uint8_t b1 = cl.rxBuf[1];
    uint8_t opcode = b0 & 0x0F;
    bool masked = (b1 & 0x80) != 0;
    uint64_t payloadLen = b1 & 0x7F;
    size_t pos = 2;

    if (payloadLen == 126) {
      if (cl.rxLen < 4) break;
      payloadLen = ((uint16_t)cl.rxBuf[2] << 8) | cl.rxBuf[3];
      pos = 4;
    } else if (payloadLen == 127) {
      closeWsSlot(idx);
      return;
    }

    if (payloadLen > (WS_RX_BUF_CAP - 16)) {
      closeWsSlot(idx);
      return;
    }

    size_t maskLen = masked ? 4 : 0;
    size_t frameSize = pos + maskLen + (size_t)payloadLen;
    if (cl.rxLen < frameSize) break;

    uint8_t maskKey[4] = {0, 0, 0, 0};
    if (masked) {
      for (int m = 0; m < 4; m++) maskKey[m] = cl.rxBuf[pos + m];
      pos += 4;
    }

    static char msgBuf[WS_RX_BUF_CAP];
    for (size_t i = 0; i < (size_t)payloadLen; i++) {
      uint8_t ch = cl.rxBuf[pos + i];
      if (masked) ch ^= maskKey[i & 3];
      msgBuf[i] = (char)ch;
    }
    msgBuf[payloadLen] = '\0';

    // Desplazar resto del buffer
    size_t remaining = cl.rxLen - frameSize;
    if (remaining > 0) {
      memmove(cl.rxBuf, cl.rxBuf + frameSize, remaining);
    }
    cl.rxLen = remaining;

    if (opcode == 0x08) {
      sendWsFrame(idx, 0x08, nullptr, 0);
      closeWsSlot(idx);
      return;
    } else if (opcode == 0x09) {
      sendWsFrame(idx, 0x0A, (const uint8_t*)msgBuf, (size_t)payloadLen);
    } else if (opcode == 0x01) {
      handleJsonMessage(String(msgBuf));
    }
  }
}

void serviceWebSocket() {
  // Aceptar nuevos clientes
  if (wsServer.hasClient()) {
    WiFiClient incoming = wsServer.available();
    bool placed = false;
    for (uint8_t i = 0; i < MAX_WS_CLIENTS; i++) {
      if (wsClients[i].stage == WS_EMPTY || !wsClients[i].sock.connected()) {
        closeWsSlot(i);
        wsClients[i].sock = incoming;
        wsClients[i].stage = WS_HANDSHAKE;
        wsClients[i].connectedMs = millis();
        wsClients[i].httpHeader = "";
        wsClients[i].rxLen = 0;
        placed = true;
        break;
      }
    }
    if (!placed) {
      incoming.stop();
    }
  }

  uint32_t now = millis();
  for (uint8_t i = 0; i < MAX_WS_CLIENTS; i++) {
    WsClientSlot& cl = wsClients[i];
    if (cl.stage == WS_EMPTY) continue;

    if (!cl.sock.connected()) {
      closeWsSlot(i);
      continue;
    }

    if (cl.stage == WS_HANDSHAKE) {
      while (cl.sock.available() > 0 && cl.httpHeader.length() < 1024) {
        cl.httpHeader += (char)cl.sock.read();
      }
      if (cl.httpHeader.indexOf("\r\n\r\n") >= 0) {
        if (!completeWsHandshake(i)) {
          closeWsSlot(i);
        }
      } else if (now - cl.connectedMs > 1500UL) {
        closeWsSlot(i);
      }
    } else if (cl.stage == WS_OPEN) {
      processWsFrames(i);
    }
  }
}

void sendTelemetryBroadcast() {
  uint8_t openCnt = countOpenWsClients();
  if (openCnt == 0) return;

  char json[320];
  int len = snprintf(
    json,
    sizeof(json),
    "{\"state\":\"%s\",\"mode\":\"%s\",\"armed\":%u,\"imu_hw\":%s,"
    "\"pitch\":%.1f,\"roll\":%.1f,\"yaw\":%.1f,"
    "\"thr\":%u,\"m1\":%u,\"m2\":%u,\"m3\":%u,\"m4\":%u,"
    "\"kp\":%.2f,\"ki\":%.2f,\"kd\":%.2f,\"tp\":%.1f,\"tr\":%.1f,\"msg\":\"%s\"}",
    stateToStr(droneState),
    activeFlightModeStr(),
    isArmedOrActive() ? 1U : 0U,
    imuHwOk ? "true" : "false",
    pitchDeg,
    rollDeg,
    yawDeg,
    (unsigned int)lroundf(cmdThr),
    motorPct[0], motorPct[1], motorPct[2], motorPct[3],
    pidKp, pidKi, pidKd, trimPitch, trimRoll,
    statusMsg.c_str()
  );

  if (len <= 0) return;
  for (uint8_t i = 0; i < MAX_WS_CLIENTS; i++) {
    if (wsClients[i].stage == WS_OPEN) {
      sendWsFrame(i, 0x01, (const uint8_t*)json, (size_t)len);
    }
  }
}

// ============================================================================
// LAZO DE CONTROL 100 HZ (PID + AIRMODE + MEZCLA + SEGURIDAD)
// ============================================================================
void updateControlAndMotors() {
  uint32_t nowMs = millis();

  // Test secuencial en tierra (solo cuando DISARMED)
  if (motorTestActive) {
    if (droneState != ST_DISARMED) {
      motorTestActive = false;
      writeAllMotorsZero();
      return;
    }
    uint32_t el = nowMs - motorTestStartMs;
    uint16_t pwm35 = (uint16_t)((35UL * PWM_MAX) / 100UL);
    writeAllMotorsZero();
    if      (el < 700)  writeMotorPwmRaw(0, pwm35);
    else if (el < 900)  writeAllMotorsZero();
    else if (el < 1600) writeMotorPwmRaw(1, pwm35);
    else if (el < 1800) writeAllMotorsZero();
    else if (el < 2500) writeMotorPwmRaw(2, pwm35);
    else if (el < 2700) writeAllMotorsZero();
    else if (el < 3400) writeMotorPwmRaw(3, pwm35);
    else {
      motorTestActive = false;
      writeAllMotorsZero();
      statusMsg = "Test motores finalizado";
    }
    return;
  }

  // Estados apagados
  if (droneState == ST_DISARMED || droneState == ST_EMERGENCY_STOP) {
    resetPidIntegrators();
    writeAllMotorsZero();
    return;
  }

  // Failsafe de desconexion (600 ms sin paquetes o sin clientes abiertos)
  if (droneState != ST_FAILSAFE_LANDING) {
    if ((nowMs - lastPacketMs > FAILSAFE_TIMEOUT_MS) ||
        (countOpenWsClients() == 0 && (nowMs - lastPacketMs > FAILSAFE_TIMEOUT_MS))) {
      if (cmdThr > 2.0f) {
        startLanding(ST_FAILSAFE_LANDING, "FAILSAFE: senal perdida, aterrizando");
      } else {
        disarmDrone("FAILSAFE: desarmado por desconexion");
        return;
      }
    }
  }

  // Rampa controlada de aterrizaje / failsafe
  if (droneState == ST_FAILSAFE_LANDING) {
    uint32_t el = nowMs - landStartMs;
    if (el >= LAND_DURATION_MS || landStartThr <= 1.0f) {
      disarmDrone("Aterrizaje completado");
      return;
    }
    float ratio = 1.0f - ((float)el / (float)LAND_DURATION_MS);
    cmdThr   = clampf(landStartThr * ratio, 0.0f, 100.0f);
    cmdPitch = 0.0f;
    cmdRoll  = 0.0f;
    cmdYaw   = 0.0f;
  }

  // Proteccion por volcamiento (> 55 grados) en modo STAB
  if (imuHwOk && (flightMode == FMODE_STAB) && !danceUseDirectPwm) {
    if (fabsf(pitchDeg) > ROLLOVER_CUTOFF_DEG || fabsf(rollDeg) > ROLLOVER_CUTOFF_DEG) {
      triggerEmergencyStop("CORTE: volcamiento > 55 deg");
      return;
    }
  }

  // Baile directo por PWM (modo DIRECT)
  if (droneState == ST_DANCING && danceUseDirectPwm) {
    for (uint8_t i = 0; i < 4; i++) {
      uint16_t pwm = (uint16_t)(((uint32_t)danceDirectPct[i] * PWM_MAX) / 100U);
      writeMotorPwmRaw(i, pwm);
    }
    return;
  }

  // Zona muerta minima en ARMADO_LISTO
  if (cmdThr < 3.0f) {
    resetPidIntegrators();
    writeAllMotorsZero();
    return;
  }

  float basePwm = (cmdThr / 100.0f) * (float)PWM_MAX;
  float uPitch = 0.0f;
  float uRoll  = 0.0f;
  float uYaw   = 0.0f;

  if (flightMode == FMODE_STAB && imuHwOk) {
    float targetPitch = (cmdPitch * MAX_TILT_DEG) + trimPitch;
    float targetRoll  = (cmdRoll  * MAX_TILT_DEG) + trimRoll;

    float errPitch = targetPitch - pitchDeg;
    float errRoll  = targetRoll  - rollDeg;

    if (cmdThr >= 8.0f) {
      iPitch = clampf(iPitch + errPitch * LOOP_DT_SEC, -250.0f, 250.0f);
      iRoll  = clampf(iRoll  + errRoll  * LOOP_DT_SEC, -250.0f, 250.0f);
    } else {
      resetPidIntegrators();
    }

    uPitch = (pidKp * errPitch) + (pidKi * iPitch) - (pidKd * gyroPitchRate);
    uRoll  = (pidKp * errRoll)  + (pidKi * iRoll)  - (pidKd * gyroRollRate);
    uYaw   = (cmdYaw * 160.0f)  - (pidKd * 0.45f * gyroYawRate);
  } else {
    // Modo DIRECTO sin lazo IMU
    uPitch = cmdPitch * 0.18f * (float)PWM_MAX;
    uRoll  = cmdRoll  * 0.18f * (float)PWM_MAX;
    uYaw   = cmdYaw   * 0.15f * (float)PWM_MAX;
  }

  // Mezcla exacta cuadricoptero X:
  // m1 (FL CW)  = throttle - uPitch + uRoll - uYaw
  // m2 (FR CCW) = throttle - uPitch - uRoll + uYaw
  // m3 (RL CCW) = throttle + uPitch + uRoll + uYaw
  // m4 (RR CW)  = throttle + uPitch - uRoll - uYaw
  float m[4];
  m[0] = basePwm - uPitch + uRoll - uYaw;
  m[1] = basePwm - uPitch - uRoll + uYaw;
  m[2] = basePwm + uPitch + uRoll + uYaw;
  m[3] = basePwm + uPitch - uRoll - uYaw;

  // Desaturacion PID (AirMode) para conservar autoridad cerca de 1023
  float maxM = m[0], minM = m[0];
  for (uint8_t i = 1; i < 4; i++) {
    if (m[i] > maxM) maxM = m[i];
    if (m[i] < minM) minM = m[i];
  }

  if (maxM > (float)PWM_MAX) {
    float shiftDown = maxM - (float)PWM_MAX;
    for (uint8_t i = 0; i < 4; i++) m[i] -= shiftDown;
  } else if (minM < 0.0f) {
    float headroom = (float)PWM_MAX - maxM;
    float shiftUp = (-minM < headroom) ? (-minM) : headroom;
    if (shiftUp > 0.0f) {
      for (uint8_t i = 0; i < 4; i++) m[i] += shiftUp;
    }
  }

  for (uint8_t i = 0; i < 4; i++) {
    uint16_t outPwm = (uint16_t)lroundf(clampf(m[i], 0.0f, (float)PWM_MAX));
    writeMotorPwmRaw(i, outPwm);
  }
}

// ============================================================================
// SETUP Y LOOP PRINCIPAL (100 HZ IMU + PID, WEBSOCKET NO BLOQUEANTE)
// ============================================================================
void setup() {
  Serial.begin(115200);

  for (uint8_t i = 0; i < 4; i++) {
    pinMode(MOTOR_PINS[i], OUTPUT);
    digitalWrite(MOTOR_PINS[i], LOW);
    #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
      ledcAttach(MOTOR_PINS[i], PWM_FREQ, PWM_RES);
    #else
      ledcSetup(i, PWM_FREQ, PWM_RES);
      ledcAttachPin(MOTOR_PINS[i], i);
    #endif
  }
  writeAllMotorsZero();

  for (uint8_t i = 0; i < MAX_WS_CLIENTS; i++) {
    wsClients[i].stage = WS_EMPTY;
    wsClients[i].rxLen = 0;
  }

  initMpu6050();

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(LOCAL_IP, GATEWAY, SUBNET);
  WiFi.softAP(AP_SSID, AP_PASS, 1, 0, 4);
  WiFi.setSleep(false);

  wsServer.begin();
  wsServer.setNoDelay(true);

  lastLoopUs = micros();
  lastTelemMs = millis();
  lastPacketMs = millis();

  Serial.println("Firmware 2 Oficial MPU-6050 + WebSocket listo.");
  Serial.print("Wi-Fi AP: "); Serial.println(AP_SSID);
  Serial.print("WS URI  : ws://"); Serial.print(WiFi.softAPIP()); Serial.println(":81");
  Serial.print("IMU HW  : "); Serial.println(imuHwOk ? "OK" : "NO DETECTADO (DIRECT)");
}

void loop() {
  serviceWebSocket();

  uint32_t nowUs = micros();
  if ((uint32_t)(nowUs - lastLoopUs) >= LOOP_PERIOD_US) {
    lastLoopUs += LOOP_PERIOD_US;
    // Evitar deriva acumulada si hubo un salto largo
    if ((uint32_t)(nowUs - lastLoopUs) > LOOP_PERIOD_US * 4UL) {
      lastLoopUs = nowUs;
    }

    updateImuStep();
    updateControlAndMotors();
  }

  uint32_t nowMs = millis();
  if (nowMs - lastTelemMs >= TELEM_PERIOD_MS) {
    lastTelemMs = nowMs;
    sendTelemetryBroadcast();
  }
}
