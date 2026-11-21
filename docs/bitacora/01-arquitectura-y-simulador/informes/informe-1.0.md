# INFORME TÉCNICO 1.0: Arquitectura de Control, Telemetría, Protección RSSI, Failsafe Exponencial y Simulador HIL para Dron Cuadricóptero de Doble Nivel (ESP32 + MPU6050)

## 1. Resumen Ejecutivo de Ingeniería
Se ha implementado de forma íntegra y sin dependencias de bases de datos SQL el ecosistema de control en tiempo real (50 Hz) para el proyecto **"Dron Cuadricóptero de Doble Nivel Controlado por ESP32 y Sensor Giroscopio MPU6050"**. El sistema comprende tres subsistemas acoplados mediante protocolos deterministas de baja latencia:

1. **Unidad de Control de Vuelo Embarcada (`/firmware-esp32/drone_controller.ino`):** Firmware sobre SoC ESP32 operando como Punto de Acceso Wi-Fi (`SSID: UDES_UAV_CONTROL`, IP estática `192.168.4.1`, puerto `81` WebSocket/UDP a 50 Hz), lectura I2C a 400 kHz del sensor inercial MPU6050 con filtro complementario, lazos PID con limitación anti-windup, mezclador cuadricóptero en configuración X para 4 etapas MOSFET de nivel lógico (PWM a 20 kHz, resolución de 10 bits), puente serial JSON a `115200 bps` cada `20 ms`, protección vectorial ante degradación RSSI y aterrizaje autónomo amortiguado sin sensores ópticos/ultrasónicos de distancia.
2. **Simulador Visual Dinámico 2D en Portátil (`/simulador-pc/index.html`):** Aplicación web autocontenida con renderizado en Canvas 2D y conexión directa al puerto COM del ESP32 vía **Web Serial API** (`115200 bps`), además de generador HIL interno a 50 Hz.
3. **Estación de Control en Tierra Móvil Android (`/app-control-uav/`):** Interfaz táctil multi-touch en orientación horizontal (*Landscape*) estructurada para empaquetado nativo con **Capacitor Android**, dotada de telemetría superior en tiempo real, horizonte artificial, alertas visuales/hápticas por umbral RSSI y corte de emergencia (*KILL SWITCH*) de doble confirmación.

---

## 2. Arquitectura Técnica Implementada por Módulo

### 2.1. Firmware Embarcado ESP32 (`/firmware-esp32/drone_controller.ino`)
* **Enlace Inalámbrico y Frecuencia de Muestreo:** Configurado mediante `WiFi.softAP("UDES_UAV_CONTROL", "UDES_UAV_2026", 6, 0, 2)` con direccionamiento estático `192.168.4.1/24`. El bucle de control se ejecuta con temporización estricta de `20000 µs` (`50 Hz`).
* **Fusión Inercial MPU6050 y Control PID:**
  * Registro DLPF `0x1A = 0x03` (ancho de banda de 44 Hz para rechazar ruido mecánico de los rotores), giroscopio en `±500 °/s` (`65.5 LSB/°/s`) y acelerómetro en `±4g` (`8192 LSB/g`).
  * Rutina de calibración inicial de *bias* giroscópico (200 muestras en arranque) y filtro complementario ($\alpha = 0.98$) para estimación libre de deriva en *Pitch* ($\theta$) y *Roll* ($\phi$).
  * Derivada calculada sobre la variable medida (`-d(measurement)/dt`) para suprimir picos transitorios (*derivative kick*) ante cambios bruscos de consigna o conmutación de estados de seguridad.
* **Puente Serial de Telemetría (115200 bps, 50 Hz):**
  * Cada `20 ms`, la función `emitTelemetryFrame()` imprime por `Serial` y retransmite por WebSocket/UDP una trama JSON compacta con la estructura:
    ```json
    {"lx":0.000,"ly":0.000,"rx":0.000,"ry":0.000,"rssi":-54,"state":"NOMINAL_FLIGHT","flag":"LINK_NOMINAL","pitch":0.00,"roll":0.00,"yaw":0.00,"az":1.000,"vbat":3.95,"m1":110,"m2":110,"m3":110,"m4":110}
    ```
* **Protección de Enlace (RSSI) y Retroceso Vectorial (`AUTO_BRAKE`):**
  * Se consulta la potencia recibida de las estaciones conectadas al AP mediante `esp_wifi_ap_get_sta_list()` y `WiFi.RSSI()`.
  * **`RSSI < -75 dBm`:** Conmuta al estado `WARN_RANGE` y emite el flag `WARN_RANGE` a la estación de control.
  * **`RSSI < -82 dBm`:** Conmuta al estado `AUTO_BRAKE`, ignora los comandos de traslación del piloto e invierte durante `800 ms` (`AUTO_BRAKE_MS = 800`) el último vector válido de *Pitch* y *Roll* (`-0.85 * lastValidPitchDeg`, `-0.85 * lastValidRollDeg`) para frenar la inercia traslacional y retornar el vehículo hacia el volumen de cobertura segura.
* **Failsafe de Aterrizaje Suave por Desconexión (`FAILSAFE_LANDING`):**
  * Un *watchdog* supervisa el intervalo entre paquetes (`HEARTBEAT_TIMEOUT = 400 ms`).
  * Al superar los `400 ms` sin recepción de tramas:
    1. Fija las consignas de actitud en `Pitch = 0.0°` y `Roll = 0.0°`.
    2. Aplica una ley de descenso exponencial amortiguada sobre el ciclo útil PWM de sustentación:
       $$PWM_{\text{desc}}(t) = PWM_{\text{floor}} + \left(PWM_{\text{entry}} - PWM_{\text{floor}}\right)\cdot e^{-t/\tau} - K_{vz}\cdot \hat{v}_z$$
    3. Evalúa el reposo mecánico sobre el eje Z del acelerómetro (`0.94g <= az_g <= 1.06g` y magnitud giroscópica `<= 4.0 °/s`). Para evitar cortes prematuros en vuelo por ráfagas o vibraciones, exige **1.5 segundos continuos** (`TOUCHDOWN_HOLD_MS = 1500`) de estabilidad e implementa una ventana de inmunidad a perturbaciones transitorias menores a **150 ms** (`GLITCH_TOL_MS = 150`).

### 2.2. Simulador Visual 2D en Portátil (`/simulador-pc/index.html`)
* Integración nativa con **Web Serial API** (`navigator.serial` a `115200 bps`) con decodificador de flujo por saltos de línea (`NDJSON`).
* Renderizado sobre cuadrícula métrica ingenieril con sub-rejilla cada 1 m y 5 m, estela de trayectoria, horizonte artificial e indicadores de ciclo útil PWM para `M1`, `M2`, `M3` y `M4`.
* **Mapeo Cinemático:**
  * **Joystick Izquierdo (`lx`, `ly`):** Gobierna la aceleración longitudinal avance/retroceso (`ly`) y el giro/desplazamiento lateral (`lx`) del cuadricóptero sobre el plano métrico.
  * **Joystick Derecho (`ry`):** Modifica suavemente la escala de cámara (**Zoom In / Zoom Out** interpolado entre `0.5x` y `2.5x`) simulando el ascenso y descenso vertical del vehículo.

### 2.3. Aplicación Móvil Android GCS (`/app-control-uav/`)
* Diseñada en orientación horizontal (*Landscape*) bajo estándar de Estación de Control en Tierra (GCS):
  * **Gimbal Izquierdo:** Control direccional (*Pitch* / *Roll*) con retorno elástico automático al origen `(0, 0)` al liberar el contacto táctil.
  * **Gimbal Derecho:** Control de altitud (*Throttle*) y velocidad angular de guiñada (*Yaw*).
  * **Barra Superior de Telemetría:** Presenta estado operacional (`CONECTADO`, `ALERTA DE ALCANCE`, `ATERRIZAJE AUTÓNOMO ACTIVO`), nivel RSSI en `dBm`, tensión estimada del bus LiPo e inclinación en tiempo real del MPU6050.
  * **Alertas y Seguridad:** Banner de alta visibilidad con vibración háptica (`navigator.vibrate`) ante cruce de umbrales RSSI y botón **KILL SWITCH** con confirmación por doble toque que envía corte inmediato de PWM (`{"kill":1,"arm":0}`).

---

## 3. Guía Exacta de Compilación del Paquete Instalable `.apk` (Android)

### 3.1. Requisitos Previos en la Estación de Desarrollo
1. **Node.js** (versión 18 LTS o superior) y **npm** instalados.
2. **Java Development Kit (JDK 17)** configurado en la variable de entorno `JAVA_HOME`.
3. **Android SDK** (Android Studio / Command-line Tools) con `ANDROID_HOME` apuntando al directorio del SDK (API Level 34 recomendado).

### 3.2. Comandos Exactos de Generación del `.apk`
Ejecutar secuencialmente desde una terminal ubicada en `C:\Dev\Control Dron\app-control-uav`:

```powershell
# 1. Posicionarse en el directorio de la aplicación móvil GCS
cd "C:\Dev\Control Dron\app-control-uav"

# 2. Instalar las dependencias de Capacitor declaradas en package.json
npm install

# 3. Inicializar la plataforma nativa Android (sólo la primera vez)
npx cap add android

# 4. Sincronizar el código fuente web (www/) y configuraciones con el proyecto Android
npx cap sync android

# 5. Compilar el archivo instalable APK de depuración mediante Gradle Wrapper
cd android
.\gradlew.bat assembleDebug
```

### 3.3. Ubicación del Archivo `.apk` Generado y Distribución
Una vez concluida la tarea `assembleDebug`, el paquete `.apk` listo para compartir por **WhatsApp**, **cable USB** o **ADB** se encuentra en:

```text
C:\Dev\Control Dron\app-control-uav\android\app\build\outputs\apk\debug\app-debug.apk
```

* **Instalación directa por cable USB (opcional vía ADB):**
  ```powershell
  adb install -r "C:\Dev\Control Dron\app-control-uav\android\app\build\outputs\apk\debug\app-debug.apk"
  ```
* **Instalación manual (WhatsApp / Memoria interna):** Transferir el archivo `app-debug.apk` al teléfono Android, abrirlo desde el gestor de archivos y autorizar la instalación desde orígenes locales.
