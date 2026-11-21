# PEDIDO 1.5: Firmware Definitivo de Vuelo Real al 100% en ESP32 con Web Local Integrada (Sin Voz y Sin Simulador PC)

## Alcance Estricto
Trabajar **ÚNICAMENTE** sobre:
1. `C:\Dev\Control Dron\firmware-esp32\drone_controller.ino`
2. `C:\Dev\Control Dron\app-control-uav\www\index.html`
3. `C:\Dev\Control Dron\Tramos\1ro\Informes\informe-1.5.md`

**NO modificar** `simulador-pc` ni `modo-wifi.js`. El objetivo es subir un solo código al ESP32, conectarse con el celular a su red Wi-Fi y volar el dron al 100% de potencia directamente desde el navegador local (`http://192.168.4.1`) o desde la App instalada.

## Hardware Definitivo Conectado
- **Placa:** ESP32 (30 pines), alimentado por elevador **MT3608** calibrado a `5.07 V` en `5V/VIN` y `GND`.
- **Batería:** Li-Ion 18650 `3.7 V` (`B+` directo a motores y `VIN+` del MT3608; `B-` común con `Source` de los 4 MOSFETs y `GND` del ESP32).
- **4 MOSFETs IRFZ44N + 4 Diodos Flyback + 4 Motores con hélices:**
  - `M1_FL` (Delantero Izquierdo, giro CW): **GPIO 25**
  - `M2_FR` (Delantero Derecho, giro CCW): **GPIO 26**
  - `M3_RL` (Trasero Izquierdo, giro CCW): **GPIO 27**
  - `M4_RR` (Trasero Derecho, giro CW): **GPIO 14**
- **Giroscopio / Acelerómetro:** **MPU6050** por I2C (`SDA = GPIO 21`, `SCL = GPIO 22`, `VCC = 3V3`, `GND = GND`, dirección `0x68`).

---

## Cambios Requeridos

### 1. Firmware Autónomo del ESP32 (`firmware-esp32/drone_controller.ino`)
- **Cero librerías externas y doble compatibilidad:** Usar exclusivamente `<WiFi.h>`, `<Wire.h>`, `<mbedtls/sha1.h>` y `<mbedtls/base64.h>`, manteniendo directivas condicionales para compilar limpio tanto en **ESP32 Core 2.x** como en **ESP32 Core 3.x** (`ledcAttach`/`ledcWrite` y `mbedtls_sha1`).
- **Eliminación total de voz (JARVIS):** Quitar cualquier rastro de `voice_msg`, `FOLLOW_ME`, `PATROL_360`, `EVASIVE_MANEUVER` o estados de simulación.
- **Red Wi-Fi + Servidor Web Local (Puerto `80`) + WebSocket Nativo (Puerto `81`):**
  - Punto de Acceso Wi-Fi: `SSID: "UDES_UAV_CONTROL"`, `PASSWORD: "12345678"`, canal `1`, IP fija `192.168.4.1`.
  - **`WiFiServer httpServer(80)`:** Cuando el celular abra `http://192.168.4.1`, el ESP32 debe responder con la interfaz completa del control de vuelo almacenada en memoria Flash (`const char INDEX_HTML[] PROGMEM = R"rawliteral(...)rawliteral";`), liviana y autocontenida (sin fuentes ni scripts externos de internet).
  - **`WiFiServer wsServer(81)`:** WebSocket nativo RFC6455 para recibir los mandos táctiles del celular a `50 Hz` y devolver telemetría en tiempo real.
- **Potencia Real al 100% para IRFZ44N a 3.3 V:**
  - Resolución PWM de `10 bits` (`0` a `1023`), donde el `100%` del acelerador entrega **`1023` (ciclo útil completo, 3.3 V continuos en Gate)**.
  - Frecuencia PWM fijada en **`2500 Hz`** (`PWM_FREQ = 2500`) para reducir pérdidas de conmutación en los IRFZ44N excitados a `3.3 V` y lograr el máximo empuje posible.
  - **Desaturación PID (AirMode):** Si `throttle + PID` supera `1023` en algún motor al estar al 100%, restar el exceso a los 4 motores por igual para no perder estabilidad a máxima potencia.
- **MPU6050 Real + Estabilización PID Configurable en Vivo:**
  - Lazo IMU + PID a **100 Hz (10 ms)**; envío de telemetría a **50 Hz (20 ms)**.
  - Constantes fáciles de editar al inicio del `.ino` por si el MPU6050 quedó girado físicamente:
    ```cpp
    const bool SWAP_PITCH_ROLL = false;
    const int8_t SIGN_PITCH    = 1;
    const int8_t SIGN_ROLL     = 1;
    const int8_t SIGN_YAW      = 1;
    ```
  - Calibración automática al encender (200 muestras quieto) y recalibración remota con `{"cmd":"CALIBRATE"}` (solo estando `DISARMED`). Si el MPU6050 no responde por I2C, reportar `"imu_hw":false` sin trabar el arranque.
  - Ganancias iniciales conservadoras: `kp = 3.0`, `ki = 0.08`, `kd = 0.85`, modificables en vivo con `{"cmd":"SET_PID","kp":...,"ki":...,"kd":...}` y trim de centro de gravedad con `{"cmd":"SET_TRIM","tp":...,"tr":...}`.
  - Mezcla exacta de motores (`M1=25 CW`, `M2=26 CCW`, `M3=27 CCW`, `M4=14 CW`):
    - `m1 = throttle - uPitch + uRoll - uYaw`
    - `m2 = throttle - uPitch - uRoll + uYaw`
    - `m3 = throttle + uPitch + uRoll + uYaw`
    - `m4 = throttle + uPitch - uRoll - uYaw`
- **Estados y Protecciones de Vuelo Real:**
  - Estados limpios: `DISARMED`, `ARMED_READY`, `FLIGHT_STABILIZED`, `FLIGHT_DIRECT`, `FAILSAFE_LANDING`, `EMERGENCY_STOP`.
  - No permitir armar si `thr > 5%`. Con `thr <= 3%` mantener los 4 motores en `0`.
  - Corte automático (`EMERGENCY_STOP`) si `abs(pitch) > 55°` o `abs(roll) > 55°` en modo estabilizado.
  - Failsafe de pérdida de señal: si pasan `400 ms` sin paquetes durante el vuelo, nivelar a `0°` y bajar el acelerador suavemente hasta `0%`.

---

### 2. Interfaz de Control Táctil (Idéntica en `PROGMEM` del ESP32 y en `app-control-uav/www/index.html`)
- Diseño horizontal (*Landscape*), oscuro, 100% autocontenido, **sin ningún elemento de voz ni micrófono**, optimizado para que ambos mandos quepan completos en pantalla (`100dvh`) con botón **"⛶ PANTALLA COMPLETA"**.
- Conexión WebSocket automática y directa a `ws://192.168.4.1:81` con reconexión cada `1 s`.
- **Controles de Vuelo (0% a 100% Real):**
  - **Izquierda (Acelerador + Yaw):** Deslizador vertical retenido de `0%` a `100%` (no se devuelve solo al soltar el dedo) + eje horizontal de rotación (`yaw`) con retorno al centro + botones rápidos **"0%"** y **"⚡ 100% MAX"** (mantiene 100% mientras se deja presionado).
  - **Derecha (Pitch + Roll):** Joystick direccional con retorno automático al centro (`0°`).
- **Barra Superior Táctica:**
  - Estado de enlace (`CONECTADO` / `DESCONECTADO`), estado del sensor (`MPU6050 OK` / `SIN MPU`), ángulos `Pitch° / Roll°` y 4 barras en vivo (`M1 25`, `M2 26`, `M3 27`, `M4 14` de `0%` a `100%`).
  - **Botón rojo KILL** grande y siempre visible (corta a `0%` y baja el deslizador).
  - **Botones:** `ARMAR / DESARMAR`, `CALIBRAR 0°`, selector `ESTABILIZADO (MPU)` vs `DIRECTO (100% Sin PID)`, `TEST MOTORES` (enciende M1 -> M2 -> M3 -> M4 al 35% por 300 ms cada uno) y panel plegable `PID / TRIM` (`Kp`, `Ki`, `Kd`, `Trim Pitch`, `Trim Roll`).

---

### 3. Informe Técnico (`C:\Dev\Control Dron\Tramos\1ro\Informes\informe-1.5.md`)
Documentar en formato conciso:
1. Mapa final de pines (ESP32 + MPU6050 + 4x IRFZ44N + MT3608 + 18650).
2. Uso de memoria Flash/RAM con la web local embebida en `PROGMEM` y frecuencia PWM de `2.5 kHz`.
3. Pasos de verificación antes de soltar el dron (Test Secuencial, prueba en mano del sentido del MPU6050, ajuste de `SIGN_PITCH`/`SIGN_ROLL` y prueba al 100%).