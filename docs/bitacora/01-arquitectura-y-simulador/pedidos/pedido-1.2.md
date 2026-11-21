# PEDIDO 1.2: Firmware ESP32 Autónomo (Cero Librerías Externas) + Puente Wi-Fi Multi-Cliente para APK y Simulador

## Problemas a Resolver
1. El botón de conexión al ESP32 en el simulador y en la App móvil no establece enlace funcional porque el firmware del ESP32 debe operar como servidor WebSocket multi-cliente en `ws://192.168.4.1:81` (recibiendo los joysticks desde el APK del celular y transmitiendo en vivo la telemetría procesada hacia el simulador del PC por Wi-Fi).
2. El archivo `firmware-esp32/drone_controller.ino` debe compilar a la primera en Arduino IDE usando únicamente librerías nativas del core ESP32 (`<WiFi.h>`, `<Wire.h>` y `<mbedtls/sha1.h>` + `<mbedtls/base64.h>`), sin depender de librerías externas de WebSockets que den error de compilación.
3. Si el ESP32 se prueba solo (sin el sensor MPU6050 conectado físicamente aún), no debe bloquearse en `setup()`, sino activar automáticamente un modo de emulación física IMU basado en los vectores de entrada del mando para mover el simulador desde el ESP32.

## Cambios Requeridos

### 1. Firmware Definitivo del ESP32 (`firmware-esp32/drone_controller.ino`)
- **Punto de Acceso Wi-Fi Directo:**
  - Configurar `WiFi.mode(WIFI_AP)` con `SSID: "UDES_UAV_CONTROL"`, `PASSWORD: "12345678"`, canal `1`, e IP estática `192.168.4.1` (máscara `255.255.255.0`).
- **Servidor WebSocket RFC6455 Nativo en Puerto `81` (`WiFiServer(81)`):**
  - Soportar hasta 4 clientes simultáneos en paralelo (Celular APK + Portátil Simulador) haciendo el handshake HTTP/WebSocket y decodificación/codificación de tramas con librerías nativas del ESP32.
  - Procesar a `50 Hz` los paquetes JSON recibidos desde la App móvil (`{"lx":...,"ly":...,"rx":...,"ry":...,"kill":...}`) y hacer **broadcast** (y envío por `Serial` a `115200 bps`) del estado completo hacia todos los clientes conectados:
    `{"lx":...,"ly":...,"rx":...,"ry":...,"pitch":...,"roll":...,"yaw":...,"rssi":...,"state":"...","m1":...,"m2":...,"m3":...,"m4":...,"imu_hw":true/false}`.
- **Detección Automática de MPU6050 + Emulación en Tiempo Real:**
  - En `setup()`, verificar por I2C (`0x68`) si el MPU6050 responde.
  - Si está conectado (`imu_hw: true`), leer acelerómetro/giroscopio real con filtro complementario.
  - Si no está conectado (`imu_hw: false`), simular la respuesta dinámica de `pitch`, `roll` y `yaw` en el propio ESP32 a partir de los joysticks recibidos, aplicando igualmente el control PID, el cálculo de los 4 motores PWM, la alerta RSSI (`WiFi.softAPgetStationNum()` / medición de enlace) y el Failsafe de aterrizaje suave a los `400 ms` de desconexión.

### 2. Conexión Directa a ESP32 en Simulador y App (`simulador-pc/index.html` y `app-control-uav/www/index.html`)
- Hacer que el botón/selector **"MODO ESP32 (`192.168.4.1:81`)"** en el simulador y en la App:
  - Cierre cualquier conexión previa e inicie conexión WebSocket directa a `ws://192.168.4.1:81` con reconexión automática cada `1.5 s`.
  - Muestre un indicador claro en pantalla del estado del enlace con el ESP32 (`CONECTADO A ESP32 [192.168.4.1]`, indicando si usa MPU6050 físico o emulado en el chip) y una guía emergente breve si aún no está conectado a la red Wi-Fi `UDES_UAV_CONTROL`.