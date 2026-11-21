# PEDIDO 1.3: Sistema de Control por Voz "JARVIS", Máquina de Estados Autónoma (Modo Sígueme / Patrulla / Evasión) en Simulador PC, App Móvil y Firmware ESP32

## Contexto y Objetivos
Integrar el asistente táctico de control por voz **"JARVIS"** (con palabra de activación configurable por el usuario para futuros cambios de nombre) sin añadir componentes de hardware adicionales al dron (ESP32 + MPU6050 + 4 motores MOSFET en GPIO 25, 26, 27 y 14). 
El sistema debe funcionar al 100% en **Simulación Completa en PC** (`modo-wifi.js` + `simulador-pc/index.html`) permitiendo hablarle directamente al micrófono del portátil o del celular (`app-control-uav/www/index.html`), y dejar actualizado el firmware `firmware-esp32/drone_controller.ino` con las mismas rutinas autónomas e informe técnico completo.

## Cambios Requeridos

### 1. Motor de Voz Bidireccional "JARVIS" (STT + TTS Offline) en Simulador PC y App Móvil
Implementar tanto en `simulador-pc/index.html` como en `app-control-uav/www/index.html`:
- **Palabra de Activación Configurable (`WAKE_WORD`):**
  - Por defecto `"jarvis"` (insensible a mayúsculas/acentos). Agregar en el HUD un campo editable compacto `Activador: [ JARVIS ]` guardado en `localStorage` para que el usuario pueda cambiar el nombre del asistente en el futuro sin modificar el código.
- **Reconocimiento de Voz Continuo (`SpeechRecognition` / `webkitSpeechRecognition`) + Botonera Táctica de Respaldo:**
  - Botón **"🎙️ JARVIS: ESCUCHANDO (ON/OFF)"** con indicador visual de onda de audio y subtítulo en tiempo real de lo que escucha el micrófono en español (`es-CO` / `es-ES`).
  - Incluir además un **Panel Desplegable de Comandos Rápidos de Voz** (botones de 1 clic que disparan exactamente el mismo comando de voz) para garantizar pruebas en PC incluso si el navegador no tiene micrófono activo.
- **Síntesis de Voz Táctica (` window.speechSynthesis`):**
  - Cada vez que JARVIS ejecuta una orden o detecta una alerta crítica, debe responder con voz hablada en español (tono grave/táctico ligeramente acelerado `rate: 1.05, pitch: 0.92`) y mostrar el texto en un banner estilo HUD de Iron Man.
- **Diccionario de Órdenes por Voz (activadas al decir el nombre del activador, ej. *"Jarvis..."*):**
  1. **«Jarvis, enciende y prepárate para vuelo»** (o *«enciende» / «arma motores»*) -> Comando `CMD_ARM`:
     - Respuesta de voz: *"En línea, señor. Sistemas calibrados. Prueba secuencial de motores completada. Cuadricóptero en ralentí listo para despegue."*
     - Acción: Ejecuta barrido de prueba encendiendo M1 -> M2 -> M3 -> M4 durante 250 ms cada uno y deja los 4 motores armados al 20% PWM con PID nivelado en `0°`.
  2. **«Jarvis, despega»** (o *«flota» / «elevar»*) -> Comando `CMD_TAKEOFF`:
     - Respuesta de voz: *"Ascendiendo a altitud de crucero. Estabilización giroscópica activa."*
     - Acción: Rampa suave de aceleración (`Throttle`) desde el valor actual hasta `58% PWM` (escala de cámara Zoom `1.6x` en el simulador) manteniendo `Pitch = 0°` y `Roll = 0°`.
  3. **«Jarvis, sígueme»** (o *«modo seguimiento»*) -> Comando `CMD_FOLLOW`:
     - Respuesta de voz: *"Modo seguimiento activado. Enganchando telemetría de señal Wi-Fi y vector de movimiento del piloto."*
     - Acción: Activa el estado autónomo `FOLLOW_ME` donde el dron persigue la posición del piloto manteniendo distancia segura (`-55 dBm` / radio de 2 metros).
  4. **«Jarvis, modo vigilancia»** (o *«patrulla» / «escanear»*) -> Comando `CMD_PATROL`:
     - Respuesta de voz: *"Iniciando barrido perimetral de trescientos sesenta grados."*
     - Acción: Activa el estado `PATROL_360` mantendo altitud fija y aplicando diferencial PWM continuo en las diagonales (M1+M3 vs M2+M4) para rotar suavemente en `Yaw`.
  5. **«Jarvis, maniobra evasiva»** (o *«esquiva»*) -> Comando `CMD_EVADE`:
     - Respuesta de voz: *"Ejecutando maniobra evasiva de alta velocidad."*
     - Acción: Inyecta un pulso de inclinación lateral (`Roll = +22°` o `-22°` durante 500 ms seguido de contrapulso de frenado de 300 ms) que desplaza rápidamente al dron fuera de su eje y lo vuelve a clavar en `0°`.
  6. **«Jarvis, aterriza»** (o *«apágate» / «descender»*) -> Comando `CMD_LAND`:
     - Respuesta de voz: *"Iniciando descenso autónomo amortiguado. Motores en corte seguro."*
     - Acción: Activa la curva exponencial de descenso suave hasta reducir el PWM a `0%` y desarmar motores.
  7. **«Jarvis, control manual»** (o mover cualquier joystick más del 15%) -> Comando `CMD_MANUAL`:
     - Respuesta de voz: *"Transfiriendo mando manual al piloto."*

### 2. Simulación Completa en PC del Modo "Sígueme" y Telemetría (`simulador-pc/index.html` y `modo-wifi.js`)
- **Avatar Interactivo del Piloto en el Canvas 2D (`simulador-pc/index.html`):**
  - Dibujar en la cuadrícula métrica un marcador táctico **"🧍 PILOTO (Emisor Wi-Fi)"** con anillos concéntricos de potencia RSSI (`-45 dBm` a `-85 dBm`).
  - En **Full Simulación PC**, permitir mover al Piloto por el mapa haciendo **clic/arrastrando con el mouse** sobre la cuadrícula o con las teclas **`W, A, S, D` / Flechas del teclado** (y también recibir el vector de pasos/inclinación desde los sensores `DeviceOrientation`/`DeviceMotion` del celular cuando esté conectado).
  - Cuando JARVIS está en estado `FOLLOW_ME`, el simulador y `modo-wifi.js` calculan en tiempo real el vector entre el Dron y el Piloto, ajustan automáticamente los ángulos `Pitch`, `Roll` y `Yaw` (orientando la nariz del dron hacia el piloto), regulan los 4 motores PWM (`M1, M2, M3, M4`) y hacen que el dron siga al piloto por toda la pantalla deteniéndose suavemente a `2.0 m` (`-55 dBm`) sin chocarlo. Si el piloto se acerca demasiado (`> -48 dBm`), el dron retrocede para conservar la distancia.

### 3. Actualización del Firmware para el ESP32 (`firmware-esp32/drone_controller.ino`)
- Mantener compilación 100% libre de librerías externas (solo `<WiFi.h>`, `<Wire.h>`, `<mbedtls/sha1.h>`, `<mbedtls/base64.h>`) y pines MOSFET en `GPIO 25 (M1)`, `GPIO 26 (M2)`, `GPIO 27 (M3)` y `GPIO 14 (M4)`.
- Ampliar el parser JSON del WebSocket (`ws://192.168.4.1:81`) para recibir `{lx, ly, rx, ry, kill, cmd, px, py}` desde la App o el Simulador PC.
- Programar dentro del bucle de `50 Hz` del ESP32 la máquina de estados autónoma completa (`IDLE_DISARMED`, `ARMING_SEQ`, `ARMED_IDLE`, `MANUAL_FLIGHT`, `AUTO_TAKEOFF`, `FOLLOW_ME`, `PATROL_360`, `EVASIVE_MANEUVER`, `AUTO_BRAKE`, `FAILSAFE_LANDING`) calculando las ecuaciones de mezcla PWM de los 4 motores y enviando en la trama JSON de retorno el estado activo y el mensaje de voz (`"voice_msg"`) para que cualquier cliente conectado reproduzca la voz de JARVIS.

### 4. Informe Técnico Detallado (`C:\Dev\Control Dron\Tramos\1ro\Informes\informe-1.3.md`)
- Generar un informe técnico completo con estándares de ingeniería (listo para anexar al formato de laboratorio UDES) que incluya:
  1. Arquitectura del subsistema de reconocimiento y síntesis de voz neuronal/nativo (Web Speech API + puente WebSocket a 50 Hz).
  2. Diagrama y tabla de transición de la Máquina de Estados Finitos (FSM) de vuelo autónomo de JARVIS.
  3. Formulación matemática del lazo de control "Modo Sígueme" (estimación de distancia por atenuación logarítmica RSSI $d = 10^{\frac{\text{RSSI}_0 - \text{RSSI}}{10n}}$ + vector de rumbo del piloto) y su traducción a consignas de ángulo *Pitch/Roll* en el controlador PID.
  4. Guía paso a paso de pruebas en modo Full Simulación PC y en modo Hardware ESP32.