# PEDIDO 1.0 (TRAMO ÚNICO): Sistema Integral de Control, Telemetría, Failsafe y Simulador para Dron ESP32 + MPU6050

## Contexto e Instrucciones Generales
Necesito implementar en un solo tramo (sin base de datos SQL) el ecosistema completo de control para el proyecto universitario "Dron Cuadricóptero de Doble Nivel Controlado por ESP32 y Sensor Giroscopio MPU6050".
Todo el lenguaje de la interfaz, variables documentadas y alertas debe ser 100% técnico y profesional (ingeniería aeroespacial/electrónica, cero lenguaje coloquial).

## Entregables Requeridos en este Tramo

### 1. Firmware del ESP32 (`/firmware-esp32/drone_controller.ino`)
- Configurar el ESP32 en modo Punto de Acceso Wi-Fi (`SSID: UDES_UAV_CONTROL`, IP estática `192.168.4.1`) con servidor WebSocket/UDP en el puerto `81` a 50 Hz.
- Lectura en tiempo real del sensor MPU6050 vía I2C (filtro complementario para Pitch y Roll) y lazo de control PID doble para 4 salidas PWM (pines MOSFET de nivel lógico).
- **Puente Serial para Simulador:** Imprimir por `Serial` (115200 bps) una trama JSON compacta cada 20 ms con `{lx, ly, rx, ry, rssi, state, pitch, roll}` para que el portátil lea los joysticks a través del ESP32.
- **Protección de Enlace (RSSI) y Retroceso Vectorial:**
  - Medir `WiFi.RSSI()`.
  - Si `RSSI < -75 dBm`, enviar flag de `WARN_RANGE` a la App.
  - Si `RSSI < -82 dBm`, activar estado `AUTO_BRAKE`: ignorar avance del usuario e invertir durante 800 ms el último vector de Pitch/Roll registrado para frenar y acercar el dron a la zona segura.
- **Failsafe de Aterrizaje Suave por Desconexión (Sin sensores de distancia):**
  - Watchdog de paquetes (`HEARTBEAT_TIMEOUT = 400 ms`).
  - Si se pierde la conexión: activar estado `FAILSAFE_LANDING`, fijar setpoint PID en `Pitch = 0°` y `Roll = 0°`, y aplicar una curva de descenso exponencial amortiguada sobre el PWM base de sustentación, reduciendo progresivamente la potencia de las hélices a medida que transcurre el tiempo de descenso hasta detectar reposo estable en el eje Z del acelerómetro (`~1g` continuo por 1.5 s sin apagar motores ante perturbaciones breves menores a 150 ms).

### 2. Simulador Visual 2D de Pruebas en Portátil (`/simulador-pc/index.html`)
- Aplicación web autocontenida en un solo archivo (`index.html` con Canvas 2D y **Web Serial API**) para conectarse al puerto COM del ESP32 desde el navegador del portátil.
- Renderizar un vehículo de pruebas sobre una cuadrícula métrica profesional con HUD de telemetría.
- **Mapeo de Controles:**
  - **Joystick Izquierdo (`lx`, `ly`):** Acelera hacia adelante/atrás y gira/desplaza hacia izquierda/derecha el vehículo.
  - **Joystick Derecho (`ry`):** Modifica la escala de cámara (**Zoom In / Zoom Out** suave entre `0.5x` y `2.5x`) simulando el ascenso y descenso del dron.
- Mostrar en pantalla el estado del Failsafe, el nivel de señal RSSI y las barras de potencia PWM de los 4 motores.

### 3. Aplicación Móvil Android (`/app-control-uav`)
- Desarrollar en HTML5/CSS/JS optimizado para empaquetado directo con **Capacitor Android** (o Flutter) para generar el `.apk` instalable en cualquier teléfono.
- Diseño en orientación horizontal (*Landscape*) con estética de estación de control en tierra (GCS):
  - **Joystick Izquierdo:** Control direccional (*Pitch* / *Roll*) con retorno automático al centro.
  - **Joystick Derecho:** Control de altitud (*Throttle*) y guiñada (*Yaw*).
  - **Panel Superior de Telemetría:** Indicador de RSSI en dBm, estado de conexión (`CONECTADO`, `ALERTA DE ALCANCE`, `ATERRIZAJE AUTÓNOMO ACTIVO`), voltaje estimado e inclinación del MPU6050.
  - **Alertas Profesionales:** Banner de alta visibilidad y vibración háptica cuando el RSSI supere el umbral de distancia segura.
  - **Botón de Parada de Emergencia (KILL SWITCH):** Corte inmediato de PWM bajo confirmación o doble toque.

### 4. Informe y Guía de Compilación APK (`/informes/informe-1.0.md`)
- Documentar la arquitectura implementada y dejar los comandos exactos para compilar el `.apk` listo para compartir por WhatsApp o USB.