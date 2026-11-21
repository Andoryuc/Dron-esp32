/**
 * @file prueba_motores_voz.ino
 * @brief Firmware 1 — Banco de Pruebas ESP32 (Testeo sin MPU-6050)
 *        - Cero librerías externas: solo <WiFi.h> y <WebServer.h>
 *        - Sin interfaz HTML pesada en PROGMEM (respuestas JSON + CORS)
 *        - Compatible con ESP32 Arduino Core 2.x y Core 3.x
 *        - Red Wi-Fi AP: "UDES_MOTORES_TEST" | Clave: "12345678" | IP: 192.168.4.1
 */

#include <WiFi.h>
#include <WebServer.h>

// ============================================================================
// PINES EXACTOS (Gate de los 4 MOSFET IRFZ44N)
// ============================================================================
static const uint8_t MOTOR_PINS[4] = {
  25, // M1: Arriba Izquierda (Delantero Izquierdo - CW)
  26, // M2: Arriba Derecha   (Delantero Derecho   - CCW)
  27, // M3: Abajo Izquierda  (Trasero Izquierdo   - CCW)
  14  // M4: Abajo Derecha    (Trasero Derecho     - CW)
};

// PWM optimizado para IRFZ44N a 3.3 V (10 bits: 0..1023, 100% = 1023 continuo)
static const uint32_t PWM_FREQ = 2500;
static const uint8_t  PWM_RES  = 10;
static const uint16_t PWM_MAX  = 1023;

// Red Wi-Fi AP local del ESP32
static const char* AP_SSID = "UDES_MOTORES_TEST";
static const char* AP_PASS = "12345678";
static const IPAddress LOCAL_IP(192, 168, 4, 1);
static const IPAddress GATEWAY(192, 168, 4, 1);
static const IPAddress SUBNET(255, 255, 255, 0);

WebServer server(80);

uint8_t motorPct[4] = {0, 0, 0, 0};

enum TestMode : uint8_t {
  MODE_MANUAL = 0,
  MODE_SEQ,
  MODE_RAMP
};

TestMode currentMode = MODE_MANUAL;
uint32_t modeStartMs = 0;

// ============================================================================
// CONTROL PWM COMPATIBLE CON ESP32 CORE 2.x Y CORE 3.x
// ============================================================================
void writeMotorPct(uint8_t idx, uint8_t pct) {
  if (idx >= 4) return;
  if (pct > 100) pct = 100;
  motorPct[idx] = pct;
  uint16_t pwm = (uint16_t)(((uint32_t)pct * PWM_MAX) / 100U);

  #if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
    ledcWrite(MOTOR_PINS[idx], pwm);
  #else
    ledcWrite(idx, pwm);
  #endif
}

void writeAllPct(uint8_t p0, uint8_t p1, uint8_t p2, uint8_t p3) {
  writeMotorPct(0, p0);
  writeMotorPct(1, p1);
  writeMotorPct(2, p2);
  writeMotorPct(3, p3);
}

void stopAllMotors() {
  currentMode = MODE_MANUAL;
  writeAllPct(0, 0, 0, 0);
}

const char* modeName() {
  if (currentMode == MODE_SEQ)  return "SECUENCIAL";
  if (currentMode == MODE_RAMP) return "RAMPA";
  return "MANUAL";
}

// ============================================================================
// CABECERAS CORS Y RESPUESTAS HTTP COMPACTAS
// ============================================================================
void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Cache-Control", "no-store");
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204, "text/plain", "");
}

void handleRoot() {
  sendCorsHeaders();
  server.send(200, "application/json", "{\"app\":\"UDES_MOTORES_TEST\",\"status\":\"ok\"}");
}

void handleSet() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  currentMode = MODE_MANUAL;

  if (server.hasArg("all")) {
    uint8_t allVal = (uint8_t)constrain(server.arg("all").toInt(), 0, 100);
    writeAllPct(allVal, allVal, allVal, allVal);
  }
  if (server.hasArg("m1")) writeMotorPct(0, (uint8_t)constrain(server.arg("m1").toInt(), 0, 100));
  if (server.hasArg("m2")) writeMotorPct(1, (uint8_t)constrain(server.arg("m2").toInt(), 0, 100));
  if (server.hasArg("m3")) writeMotorPct(2, (uint8_t)constrain(server.arg("m3").toInt(), 0, 100));
  if (server.hasArg("m4")) writeMotorPct(3, (uint8_t)constrain(server.arg("m4").toInt(), 0, 100));

  char buf[128];
  snprintf(
    buf,
    sizeof(buf),
    "{\"status\":\"ok\",\"mode\":\"MANUAL\",\"m1\":%u,\"m2\":%u,\"m3\":%u,\"m4\":%u}",
    motorPct[0], motorPct[1], motorPct[2], motorPct[3]
  );

  sendCorsHeaders();
  server.send(200, "application/json", buf);
}

void handleStop() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  stopAllMotors();
  Serial.println("STOP -> Todos los motores en 0%");

  sendCorsHeaders();
  server.send(200, "application/json", "{\"status\":\"stopped\",\"mode\":\"MANUAL\",\"m1\":0,\"m2\":0,\"m3\":0,\"m4\":0}");
}

void handleSeq() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  stopAllMotors();
  currentMode = MODE_SEQ;
  modeStartMs = millis();
  Serial.println("SEQ -> M1 -> M2 -> M3 -> M4 (35%)");

  sendCorsHeaders();
  server.send(200, "application/json", "{\"status\":\"ok\",\"mode\":\"SECUENCIAL\"}");
}

void handleRamp() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  stopAllMotors();
  currentMode = MODE_RAMP;
  modeStartMs = millis();
  Serial.println("RAMP -> Rampa suave 0% -> 100% -> 0%");

  sendCorsHeaders();
  server.send(200, "application/json", "{\"status\":\"ok\",\"mode\":\"RAMPA\"}");
}

void handleStatus() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }

  char buf[96];
  snprintf(
    buf,
    sizeof(buf),
    "{\"mode\":\"%s\",\"m1\":%u,\"m2\":%u,\"m3\":%u,\"m4\":%u}",
    modeName(), motorPct[0], motorPct[1], motorPct[2], motorPct[3]
  );

  sendCorsHeaders();
  server.send(200, "application/json", buf);
}

void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) {
    handleOptions();
    return;
  }
  sendCorsHeaders();
  server.send(404, "application/json", "{\"error\":\"not_found\"}");
}

// ============================================================================
// RUTINAS AUTOMATICAS NO BLOQUEANTES
// ============================================================================
void updateAutoModes() {
  if (currentMode == MODE_MANUAL) return;

  uint32_t elapsed = millis() - modeStartMs;

  if (currentMode == MODE_SEQ) {
    if (elapsed < 700)       writeAllPct(35, 0, 0, 0);
    else if (elapsed < 900)  writeAllPct(0, 0, 0, 0);
    else if (elapsed < 1600) writeAllPct(0, 35, 0, 0);
    else if (elapsed < 1800) writeAllPct(0, 0, 0, 0);
    else if (elapsed < 2500) writeAllPct(0, 0, 35, 0);
    else if (elapsed < 2700) writeAllPct(0, 0, 0, 0);
    else if (elapsed < 3400) writeAllPct(0, 0, 0, 35);
    else {
      stopAllMotors();
      Serial.println("Test secuencial terminado.");
    }
    return;
  }

  if (currentMode == MODE_RAMP) {
    if (elapsed < 3000) {
      uint8_t pct = (uint8_t)((elapsed * 100UL) / 3000UL);
      writeAllPct(pct, pct, pct, pct);
    } else if (elapsed < 3600) {
      writeAllPct(100, 100, 100, 100);
    } else if (elapsed < 6100) {
      uint8_t pct = (uint8_t)(100UL - ((elapsed - 3600UL) * 100UL) / 2500UL);
      writeAllPct(pct, pct, pct, pct);
    } else {
      stopAllMotors();
      Serial.println("Rampa suave terminada.");
    }
  }
}

// ============================================================================
// SETUP Y LOOP
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
  stopAllMotors();

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(LOCAL_IP, GATEWAY, SUBNET);
  WiFi.softAP(AP_SSID, AP_PASS, 1, 0, 4);
  WiFi.setSleep(false);

  server.on("/", HTTP_ANY, handleRoot);
  server.on("/set", HTTP_ANY, handleSet);
  server.on("/stop", HTTP_ANY, handleStop);
  server.on("/seq", HTTP_ANY, handleSeq);
  server.on("/ramp", HTTP_ANY, handleRamp);
  server.on("/status", HTTP_ANY, handleStatus);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("Firmware 1 Testeo listo (sin HTML en PROGMEM).");
  Serial.print("Wi-Fi AP: "); Serial.println(AP_SSID);
  Serial.print("IP      : http://"); Serial.println(WiFi.softAPIP());
}

void loop() {
  server.handleClient();
  updateAutoModes();
}
