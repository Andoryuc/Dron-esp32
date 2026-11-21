# INFORME 1.2: Firmware ESP32 Autónomo (Cero Librerías Externas) + Puente Wi-Fi Multi-Cliente para APK y Simulador

## 1. Resumen Ejecutivo
Se ejecutó íntegramente el **Pedido 1.2** editando directamente los archivos del proyecto sin utilizar la terminal, garantizando que el microcontrolador ESP32 opere como **Punto de Acceso Wi-Fi y Servidor WebSocket RFC6455 multi-cliente nativo en `ws://192.168.4.1:81`** sin depender de librerías externas, con detección automática del sensor MPU6050 en bus I2C (`0x68`), emulación física IMU en chip cuando se prueba el ESP32 solo, y enlace directo desde la App móvil y el Simulador 2D del portátil.

---

## 2. Cambios Implementados

### 2.1. Firmware Definitivo del ESP32 (`firmware-esp32/drone_controller.ino`)
- **Cero Librerías Externas (Compilación Directa en Arduino IDE):**
  - Se eliminó la dependencia de `<WebSocketsServer.h>` y se implementó el protocolo **WebSocket RFC6455 completo** usando únicamente librerías nativas del core oficial ESP32 (`<Arduino.h>`, `<Wire.h>`, `<WiFi.h>`, `<esp_wifi.h>`, `<mbedtls/sha1.h>` y `<mbedtls/base64.h>`), compatible tanto con ESP32 Arduino Core 2.x como 3.x.
- **Punto de Acceso Wi-Fi Directo (`WIFI_AP`):**
  - Configurado con `SSID: "UDES_UAV_CONTROL"`, `PASSWORD: "12345678"`, canal `1`, hasta `4` estaciones simultáneas, ahorro de energía desactivado (`WiFi.setSleep(false)`) e IP estática `192.168.4.1` (máscara `255.255.255.0`).
- **Servidor WebSocket RFC6455 Multi-Cliente en Puerto `81` (`WiFiServer(81)`):**
  - Soporta hasta **4 clientes WebSocket simultáneos en paralelo** (`wsClients[4]`), permitiendo conectar a la vez el celular (APK/App Web) y el portátil (Simulador 2D).
  - Realiza el handshake HTTP Upgrade (`101 Switching Protocols` con cálculo SHA-1 + Base64 de `Sec-WebSocket-Accept`), decodificación de tramas enmascaradas de cliente (`0x01` texto, `0x08` close, `0x09` ping → `0x8A` pong) y codificación de tramas de longitud estándar y extendida (16-bit `126`) sin bloqueo.
  - Procesa a **50 Hz (`20 ms`)** los paquetes JSON de los joysticks (`{"lx":...,"ly":...,"rx":...,"ry":...,"kill":...}`) y realiza **broadcast** simultáneo a todos los clientes WebSocket conectados y por `Serial` a `115200 bps` de la trama completa:
    ```json
    {"lx":0.000,"ly":0.000,"rx":0.000,"ry":0.000,"pitch":0.00,"roll":0.00,"yaw":0.00,"rssi":-50,"state":"NOMINAL_FLIGHT","flag":"LINK_NOMINAL","az":1.000,"vbat":3.95,"m1":450,"m2":450,"m3":450,"m4":450,"imu_hw":false}
    ```
- **Detección Automática de MPU6050 (`0x68`) + Emulación Física en Chip:**
  - En `setup()`, `initMpu6050()` verifica por I2C (`0x68`, SDA=21, SCL=22 a 400 kHz con timeout no bloqueante) si el sensor físico responde.
  - Si responde (`imu_hw: true`), calibra el giroscopio y ejecuta la lectura real de acelerómetro y giroscopio con filtro complementario ($\alpha = 0.98$).
  - Si no está conectado (`imu_hw: false`), no bloquea `setup()` y activa `emulateImuDynamics(dt)`, emulando en tiempo real dentro del ESP32 la dinámica inercial de `pitch`, `roll`, `yaw`, velocidades angulares y aceleración vertical a partir de los joysticks recibidos, ejecutando el control PID completo, el mezclador en X para los 4 motores PWM (`m1..m4`), la supervisión de RSSI (`WiFi.softAPgetStationNum()` / `esp_wifi_ap_get_sta_list()`) y el Failsafe de aterrizaje suave a los `400 ms` de desconexión.

### 2.2. Simulador 2D en Portátil (`simulador-pc/index.html`)
- **Botón `"MODO ESP32 (192.168.4.1:81)"` (`#btnPresetEsp`):**
  - Cierra de inmediato cualquier conexión previa, fija el endpoint en `ws://192.168.4.1:81` e inicia conexión WebSocket directa con reconexión automática cada **1.5 s (`1500 ms`)**.
- **Indicador de Enlace ESP32 y Fuente IMU (`#esp32LinkBanner` y `#hudImuMode`):**
  - Muestra en pantalla **`CONECTADO A ESP32 [192.168.4.1]`** junto con el badge que distingue en tiempo real si el ESP32 opera con **`MPU6050 FÍSICO (I2C 0x68)`** (`imu_hw: true`) o **`IMU EMULADA EN CHIP ESP32`** (`imu_hw: false`).
- **Guía Emergente Breve (`#esp32GuidePopover`):**
  - Si aún no se ha establecido conexión con la red Wi-Fi del ESP32, despliega una guía emergente concisa indicando el SSID (`UDES_UAV_CONTROL`), contraseña (`12345678`) y el reintento automático cada `1.5 s`, ocultándose automáticamente en cuanto el WebSocket conecta.

### 2.3. Aplicación Móvil GCS (`app-control-uav/www/index.html`, `app.js` y `styles.css`)
- **Botones `"MODO ESP32 (192.168.4.1:81)"` (`#btnEsp32ModeTop` en barra superior y `#btnConnectWs` en consola central):**
  - Cierran cualquier socket previo, fijan `192.168.4.1:81` e inician conexión WebSocket directa a `ws://192.168.4.1:81` con reconexión automática cada **1.5 s (`1500 ms`)**.
- **Indicador de Estado ESP32 e IMU (`#valConnState`, `#valImuHwBadge`, `#lblHorizonTitle`):**
  - Muestra claramente **`CONECTADO A ESP32 [192.168.4.1]`** indicando si utiliza **`MPU6050 FÍSICO`** o **`IMU EMULADA EN CHIP`**, además de mostrar el banner guía emergente (`#esp32GuidePopover`) con los datos de la red `UDES_UAV_CONTROL` (clave `12345678`) mientras espera conexión.
