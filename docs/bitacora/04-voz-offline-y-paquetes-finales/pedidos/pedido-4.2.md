# PEDIDO 4.2 (TRAMO 4): Dos Firmwares ESP32 (Testeo y Oficial con MPU-6050) + Dos APK Android Co-Instalables con Voz Offline "Dron" (Sin Bucle y Bailes con Memoria de Potencia)

## Objetivo General
Construir y compilar **dos paquetes completos e independientes** (2 firmwares `.ino` para ESP32 sin interfaz web pesada en `PROGMEM` + 2 archivos `.apk` Android que pueden instalarse simultáneamente en el mismo celular sin sobrescribirse), corrigiendo de raíz el bucle de voz, cambiando el activador de `"Firulais"` a `"Dron"`, y asegurando que ambas canciones suenen una sola vez sin apagar los motores si el dron estaba volando.

### Entregables Exactos
1. **Firmware Testeo (sin MPU-6050):** actualizar en su ubicación actual `C:\Dev\Control Dron\Tramos\4to\esp32_test\prueba_motores_voz.ino`
2. **Firmware Oficial (con MPU-6050 + PID):** crear `C:\Dev\Control Dron\Tramos\4to\esp32_oficial\dron_oficial_mpu6050\dron_oficial_mpu6050.ino`
3. **APK 1 — Dron Testeo:** `C:\Dev\Control Dron\Tramos\4to\APKs\dron-testeo.apk` (App Name: `Dron Testeo`, `applicationId: com.udes.drontesteo`)
4. **APK 2 — Dron Oficial:** `C:\Dev\Control Dron\Tramos\4to\APKs\dron-oficial.apk` (App Name: `Dron Oficial`, `applicationId: com.udes.dronoficial`)
5. **Script de compilación dual:** `C:\Dev\Control Dron\compilar-dos-apks.ps1`
6. **Informe técnico:** `C:\Dev\Control Dron\Tramos\4to\Informe\informe-4.2.md`

**NO modificar** `C:\Dev\Control Dron\presentacion-3d\`, ni archivos `.stl`, ni `Tramos\1ro\`, `2do\` o `3ro\`.

---

## 1. Correcciones Críticas al Motor de Voz Offline (`VoskVoicePlugin.java` + Lógica JS compartida)

Inspeccionar primero `app-control-uav\android\app\src\main\java\...\VoskVoicePlugin.java` y el código JS actual en `app-control-uav\www\` para corregir estos 4 fallos obligatorios en **ambos APK**:

### A. Cambio Total de Wake Word: `"Dron"` (Eliminar `"Firulais"`)
- Eliminar por completo toda referencia a `"Firulais"` en Java, JavaScript, interfaz HTML, textos TTS y `localStorage`.
- Verificar si `"dron"` / `"drone"` existen en `app-control-uav\android\app\src\main\assets\vosk-model-es\graph\words.txt`.
- Ningún comando se ejecuta si la frase normalizada (minúsculas, sin tildes ni signos) no comienza con `"dron"` o alguno de sus alias fonéticos cercanos (`dron`, `drone`, `tron`, `bron`, `drom`, `don dron`, más los alias que el usuario agregue con el botón **`🧪 Calibrar 'Dron'`** guardado en `localStorage`).

### B. Eliminación Total del Bucle Infinito de Voz (Anti-Eco y Anti-Repetición)
- **Prohibido disparar comandos desde `onPartialResult`:** El texto parcial solo se puede mostrar en pantalla de forma informativa; la ejecución de comandos debe ocurrir **únicamente en `onResult` / `onFinalResult`** (frase terminada).
- **Silenciamiento real del micrófono durante TTS y Canciones (en `VoskVoicePlugin.java`):**
  - Mantener bandera nativa atómica `isAudioBusy` (`true` desde antes de iniciar `tts.speak(...)` o `mediaPlayer.start()`).
  - Antes de hablar o reproducir canción: pausar `speechService.setPause(true)` (o descartar 100% de los callbacks) y usar siempre `TextToSpeech.QUEUE_FLUSH` (nunca `QUEUE_ADD`) para evitar colas repetidas.
  - Al terminar el TTS (`UtteranceProgressListener.onDone` / `onError`): ejecutar `recognizer.reset()` (para borrar cualquier residuo de audio del altavoz en el búfer), esperar **600 ms de enfriamiento anti-eco**, y recién entonces reactivar `speechService.setPause(false)` y notificar `ttsEnd` a JS.
- **Protección contra doble disparo en JS:**
  - Agregar `cooldown` de `1800 ms` tras procesar un comando.
  - En el estado `AWAITING_OFF_CONFIRM` (ventana de `8 s` tras preguntar *"¿Estás seguro?"*): si vuelve a llegar `"dron apaga"` sin decir `"estoy seguro"`, NO entrar en bucle; solo esperar la confirmación exacta **`"Dron, estoy seguro, apágate"`** (o cancelar silenciosamente al vencerse los 8 segundos).
- Mantener la voz masculina offline en español (`es-CO` / `es-ES` / `es-MX`, `pitch ~0.78f`).

### C. Reproducción Única de Canciones y Memoria de Potencia (Cero Apagados en Vuelo)
Verificar que ambas canciones existan en `app-control-uav\android\app\src\main\assets\audio\` (`sacamos_cinco.mpeg` de 14 s y `que_te_vale.mpeg` de 22 s; si faltan, copiarlas desde `C:\Dev\Control Dron\Tramos\4to\Canciones\`).
- **`MediaPlayer` de 1 sola reproducción:**
  - Configurar explícitamente `mediaPlayer.setLooping(false)`.
  - Si ya existe una canción sonando (`isDancing === true`), ignorar completamente cualquier intento de volver a lanzarla.
  - Mantener `speechService.setPause(true)` durante **toda la duración de la canción**. Al dispararse `OnCompletionListener`, llamar `recognizer.reset()`, esperar **1200 ms** de enfriamiento post-canción y solo entonces reanudar escucha y emitir `songEnded`.
- **Guardado y Restauración de Potencia Previa:**
  - En el instante exacto en que inicia un baile (`"Dron, sacamos cinco"` o `"Dron, qué te vale"`), guardar una instantánea de la potencia previa: `preDancePower` (porcentaje maestro / acelerador actual y arreglo `[m1, m2, m3, m4]` + `modoVuelo`).
  - **Si el dron YA tenía potencia activa (`preDancePower > 0`):** usar `preDancePower` como potencia base del baile (sin bajarlo nunca a `0%` en los bajoncitos bruscos; respetar un piso mínimo seguro `max(danceMinPct, preDancePower - amp * 1.35)` si está volando, donde `danceMinPct` es configurable, por defecto `20%`). Al terminar la canción, **restaurar suavemente la potencia exacta `preDancePower`** en ~400 ms para que el dron siga volando sin caerse.
  - **Si el dron estaba en `0%` (en mesa):** usar `danceBasePct` configurable (por defecto `45%`) para la demostración y al terminar la canción bajar suavemente a `0%`.
  - Mantener el bloqueo durante el baile: la voz queda deshabilitada; si el usuario toca un control manual aparece el modal **`¿Seguro que quieres deshabilitar el baile? [SÍ / NO]`**. Si elige `SÍ`, detiene la música y devuelve la potencia previa segura (solo corta a `0%` si tocó el botón rojo de emergencia `KILL / APAGAR TODO`).

### D. Repertorio Exacto de Comandos con `"Dron"`
1. **`Dron, enciende`**: enciende motores al porcentaje seleccionado (en Testeo) o arma/enciende a la potencia seleccionada (en Oficial). Respuesta TTS (1 vez): *"Motores encendidos al X por ciento."*
2. **`Dron, estás volando`**: activa `MODO VUELO` (bloquea `Dron, apaga` / `Dron, para`, dejando habilitado solo `Dron, aterriza`). Respuesta TTS (1 vez): *"Modo vuelo activado. Apagado directo bloqueado, solo aterrizaje suave."*
3. **`Dron, aterriza`**: único apagado por voz permitido en `MODO VUELO`; ejecuta rampa suave de bajada (~3.5 s) desde la potencia actual hasta `0%`, envía corte final y desactiva `MODO VUELO`. Respuesta TTS: *"Iniciando aterrizaje suave."* y al terminar *"Aterrizaje completado."*
4. **`Dron, apaga`** (o **`Dron, para`**):
   - Si está bailando: ignorado.
   - Si `potenciaActual >= umbralDespegueHelio` O `modoVuelo === true`: **BLOQUEADO**, no apaga nada y responde (1 vez): *"Estoy volando, te paso el control manual."*
   - Si está debajo del umbral y sin `modoVuelo`: entra a `AWAITING_OFF_CONFIRM` por `8 s` y pregunta (1 vez): *"¿Estás seguro?"*. Solo si el usuario responde **`Dron, estoy seguro, apágate`** (alias: `estoy seguro apagate`, `estoy seguro apaga`, `seguro apagate`), apaga los motores a `0%` y responde (1 vez): *"Confirmado. Motores apagados."*
5. **`Dron, sacamos cinco`**: reproduce `sacamos_cinco.mpeg` (14 s, 1 sola vez) con la coreografía festiva sincronizada al ritmo (3 golpes de entrada 0–2.5 s + balanceos rápidos laterales/frontales/diagonales 2.5–12.6 s + remate 12.6–14 s).
6. **`Dron, qué te vale`**: reproduce `que_te_vale.mpeg` (22 s, 1 sola vez) con la coreografía de balanceo en el coro y **bajoncitos bruscos rítmicos** en los tramos graves (5.2–11.4 s y 15.6–21.8 s), respetando siempre el piso mínimo seguro si está volando.

---

## 2. Firmware 1 — ESP32 Testeo (`C:\Dev\Control Dron\Tramos\4to\esp32_test\prueba_motores_voz.ino`)
Inspeccionar primero el archivo actual en `C:\Dev\Control Dron\Tramos\4to\esp32_test\prueba_motores_voz.ino` y optimizarlo sin romper su compatibilidad:
- **Sin giroscopio (`Wire.h`) y sin librerías externas** (solo `<WiFi.h>` y `<WebServer.h>`), compatible con ESP32 Arduino Core 2.x y Core 3.x.
- **Eliminar el bloque pesado `INDEX_HTML` en `PROGMEM`:** La ruta `/` devuelve únicamente un JSON compacto de estado (`{"app":"UDES_MOTORES_TEST","status":"ok"}`) para ahorrar memoria Flash y acelerar el bucle.
- **Red Wi-Fi AP:** `SSID: "UDES_MOTORES_TEST"`, `PASS: "12345678"`, IP fija `192.168.4.1`, `WiFi.setSleep(false)`.
- **Pines exactos (Gate de los 4 IRFZ44N):** `M1 = GPIO 25` (Arriba Izq CW), `M2 = GPIO 26` (Arriba Der CCW), `M3 = GPIO 27` (Abajo Izq CCW), `M4 = GPIO 14` (Abajo Der CW).
- **PWM optimizado para IRFZ44N a 3.3 V:** `PWM_FREQ = 2500 Hz`, resolución `10 bits` (`0..1023`, donde `100% = 1023` continuo).
- **Endpoints HTTP con cabeceras CORS (`Access-Control-Allow-Origin: *`):**
  - `GET /set?m1=..&m2=..&m3=..&m4=..` (y/o `?all=..`): fija potencia individual `0..100%` en cada motor.
  - `GET /stop`: corte inmediato a `0%` y cancela modos automáticos.
  - `GET /seq`: test secuencial `M1 -> M2 -> M3 -> M4` al `35%`.
  - `GET /ramp`: rampa suave `0% -> 100% -> 0%`.
  - `GET /status`: devuelve JSON `{"mode":"...","m1":0,"m2":0,"m3":0,"m4":0}`.

---

## 3. Firmware 2 — ESP32 Oficial con MPU-6050 (`C:\Dev\Control Dron\Tramos\4to\esp32_oficial\dron_oficial_mpu6050\dron_oficial_mpu6050.ino`)
Crear el firmware completo de vuelo real, **cero librerías externas** (solo `<WiFi.h>`, `<Wire.h>`, `<mbedtls/sha1.h>`, `<mbedtls/base64.h>`), **sin web HTML en `PROGMEM`**, y compatible con ESP32 Arduino Core 2.x y 3.x:
- **Red Wi-Fi AP:** `SSID: "UDES_UAV_CONTROL"`, `PASS: "12345678"`, canal `1`, IP fija `192.168.4.1`, `WiFi.setSleep(false)`.
- **Servidor WebSocket RFC6455 nativo en puerto `81`** (hasta 3 clientes simultáneos, lectura de mandos a `50 Hz` y envío de telemetría JSON a `25–50 Hz`).
- **Hardware definitivo:**
  - Motores IRFZ44N: `M1_FL = GPIO 25 (CW)`, `M2_FR = GPIO 26 (CCW)`, `M3_RL = GPIO 27 (CCW)`, `M4_RR = GPIO 14 (CW)`, `PWM_FREQ = 2500 Hz`, 10 bits (`0..1023`).
  - MPU-6050 por I2C: `SDA = GPIO 21`, `SCL = GPIO 22`, dirección `0x68`. Si el MPU-6050 no responde al encender, NO bloquear el ESP32: reportar `"imu_hw": false` y permitir vuelo en modo `DIRECT`.
- **Lazo IMU + PID a `100 Hz` (cada `10 ms`):**
  - Filtro complementario para `Pitch` y `Roll` + integración de `Yaw`.
  - Constantes editables al inicio del archivo para orientación del sensor: `SWAP_PITCH_ROLL = false`, `SIGN_PITCH = 1`, `SIGN_ROLL = 1`, `SIGN_YAW = 1`.
  - Calibración automática al iniciar (200 muestras en reposo) y recalibración remota con `{"cmd":"CALIBRATE"}` (solo en `DISARMED`).
  - Ganancias PID iniciales conservadoras (`kp = 3.0`, `ki = 0.08`, `kd = 0.85`) ajustables en vivo con `{"cmd":"SET_PID","kp":..,"ki":..,"kd":..}` y trim de centro de gravedad con `{"cmd":"SET_TRIM","tp":..,"tr":..}`.
  - Desaturación PID (AirMode) para conservar autoridad de estabilización incluso cerca del `100%` (`1023`).
  - Mezcla exacta:
    - `m1 (FL CW)  = throttle - uPitch + uRoll - uYaw`
    - `m2 (FR CCW) = throttle - uPitch - uRoll + uYaw`
    - `m3 (RL CCW) = throttle + uPitch + uRoll + uYaw`
    - `m4 (RR CW)  = throttle + uPitch - uRoll - uYaw`
- **Modos, Bailes y Seguridad Real:**
  - Estados: `DISARMED`, `ARMED_READY`, `FLIGHT_STABILIZED`, `FLIGHT_DIRECT`, `DANCING`, `FAILSAFE_LANDING`, `EMERGENCY_STOP`.
  - **Protocolo WebSocket JSON (App -> ESP32):**
    - Control continuo: `{"thr":0..100, "pitch":-1..1, "roll":-1..1, "yaw":-1..1, "kill":0/1}`
    - Comandos puntuales: `{"cmd":"ARM"}`, `{"cmd":"DISARM"}`, `{"cmd":"CALIBRATE"}`, `{"cmd":"MODE_STAB"}`, `{"cmd":"MODE_DIRECT"}`, `{"cmd":"TEST_MOTORS"}`, `{"cmd":"LAND_START"}`, `{"cmd":"SET_PID",...}`, `{"cmd":"SET_TRIM",...}`.
    - Baile sincronizado desde el APK:
      - En modo `STAB` (con MPU-6050): aceptar `{"cmd":"DANCE_STAB","thr":0..100,"pitch":-1..1,"roll":-1..1}` para que el dron baile con balanceos y bajoncitos bruscos **manteniéndose nivelado con el PID sin volcarse**.
      - En modo `DIRECT` (sin PID): aceptar `{"cmd":"DANCE_PWM","m1":0..100,"m2":0..100,"m3":0..100,"m4":0..100}` para control directo de los 4 motores.
      - Al finalizar baile: `{"cmd":"DANCE_END","thr":0..100}` devuelve el control normal sin apagar los motores si `thr > 0`.
  - **Seguridad:** No armar si `thr > 5%` (salvo orden explícita de encendido por voz a un porcentaje definido, que arma y aplica ese porcentaje). Corte automático por volcamiento si `abs(pitch) > 55°` o `abs(roll) > 55°` en modo `STAB`. Failsafe de desconexión: si pasan `600 ms` sin paquetes estando armado/volando, activar `FAILSAFE_LANDING` nivelando a `0°` y descendiendo suavemente hasta `0%`.

---

## 4. Diseño de las Dos Aplicaciones Android (Co-Instalables con Flavors Gradle)

Organizar las dos interfaces web en carpetas limpias dentro de `C:\Dev\Control Dron\app-control-uav\`:
- `www-testeo/` (interfaz del APK **Dron Testeo**)
- `www-oficial/` (interfaz del APK **Dron Oficial**)

### A. Interfaz `www-testeo/` — APK `Dron Testeo` (`com.udes.drontesteo`)
- Orientación flexible (`unspecified`), tema oscuro técnico de banco de pruebas.
- Conecta automáticamente por HTTP a `http://192.168.4.1` (red `UDES_MOTORES_TEST`) con indicador de enlace vivo.
- Incluye: botón rojo grande **`⛔ APAGAR TODO (0%)`**, tarjeta de **Control por Voz Offline (`Dron`)** con indicador de estado (`LISTO / MODO VUELO / ESPERANDO CONFIRMACIÓN / ATERRIZANDO / BAILANDO`), visor de transcripción Vosk, botón **`🧪 Calibrar 'Dron'`**, **`🎈 Umbral de despegue (Helio)`**, tarjeta plegable **`🕺 Configuración de Baile`** (`Base`, `Amplitud`, `Piso mínimo`) + botones de prueba rápida de los 2 bailes, slider maestro `0..100%`, 4 sliders individuales (`M1 25`, `M2 26`, `M3 27`, `M4 14`), y botones `▶ Test 1 → 2 → 3 → 4` y `📈 Rampa Suave`.

### B. Interfaz `www-oficial/` — APK `Dron Oficial` (`com.udes.dronoficial`)
- Orientación horizontal fija (**`sensorLandscape`**), diseño ergonómico de cabina de control que quepa completo en `100dvh` sin cortar los mandos ni obligar a hacer scroll durante el vuelo.
- Conecta automáticamente por WebSocket a `ws://192.168.4.1:81` (red `UDES_UAV_CONTROL`) con reconexión automática cada `1 s`.
- **Distribución exacta de mandos:**
  - **Lado Izquierdo — Joystick Direccional (`Pitch` + `Roll`):** Palanca circular táctil multitouch para mover el dron adelante/atrás e izquierda/derecha, con **retorno suave automático al centro (`0°`)** al soltar el dedo.
  - **Lado Derecho — Palanca Vertical Retenida de Acelerador (`0%` a `100%`):** Deslizador vertical grande y preciso que **mantiene la posición donde lo dejes** (NO se devuelve a `0%` al soltar el dedo), acompañado de botones rápidos `0%`, `⚡ 100%` y un control compacto horizontal de `Yaw` (giro sobre su eje con retorno al centro).
- **Zona Central y Barra Superior Táctica:**
  - Estado de enlace (`CONECTADO 192.168.4.1`), sensor (`MPU-6050 OK` / `SIN MPU`), ángulos en vivo `Pitch° / Roll°`, y 4 barras compactas de potencia (`M1`, `M2`, `M3`, `M4`).
  - Botón rojo **`⛔ KILL`** grande y siempre accesible en el centro superior.
  - Controles rápidos centrales: **`ARMAR / DESARMAR`**, **`CALIBRAR 0°`**, selector **`ESTABILIZADO (MPU)` / `DIRECTO`**, **`TEST MOTORES`**.
  - **Botón/Widget de Voz Offline (`🎙️ Dron`) siempre accesible en el centro:** muestra el estado actual (`LISTO`, `MODO VUELO`, `BAILANDO`, `¿SEGURO?`), transcripción breve, y un cajón desplegable **`⚙️ Voz / Baile / PID`** donde se configuran:
    - `🎈 Umbral Helio %`, `🧪 Calibrar 'Dron'`, `Base / Amplitud / Piso de baile`, botones rápidos para probar los 2 bailes, y los sliders de **`PID / TRIM`** (`Kp`, `Ki`, `Kd`, `Trim Pitch`, `Trim Roll` + botón `Aplicar al ESP32`).
  - Sincronizar visualmente la palanca vertical de acelerador con cualquier cambio hecho por voz (`Dron, enciende`, `Dron, aterriza` y restauración tras el baile).

---

## 5. Configuración Gradle Dual y Compilación de Ambos APK (`compilar-dos-apks.ps1`)
- En `app-control-uav\android\app\build.gradle`, configurar `flavorDimensions "edition"` con dos `productFlavors` que compartan el mismo `VoskVoicePlugin.java`, el modelo `vosk-model-es` y los dos audios de `assets/audio/`:
  - **`testeo`:** `applicationId "com.udes.drontesteo"`, `manifestPlaceholders = [appOrientation: "unspecified"]`
  - **`oficial`:** `applicationId "com.udes.dronoficial"`, `manifestPlaceholders = [appOrientation: "sensorLandscape"]`
- Definir `strings.xml` separados en `android/app/src/testeo/res/values/strings.xml` (`Dron Testeo`) y `android/app/src/oficial/res/values/strings.xml` (`Dron Oficial`) retirando `app_name` y `title_activity_main` del `src/main/res/values/strings.xml` base para evitar conflictos de recursos, y usar `android:screenOrientation="${appOrientation}"` en `AndroidManifest.xml`.
- Crear `C:\Dev\Control Dron\compilar-dos-apks.ps1` (reutilizando `C:\Dev\Control Dron\.build-tools` de JDK 17 y Android SDK ya instalados) para que de forma automática:
  1. Limpie `app-control-uav\www\`, copie `www-testeo\*` en `www\`, ejecute `npx cap sync android`, compile `.\gradlew.bat assembleTesteoDebug` y copie el resultado a `C:\Dev\Control Dron\Tramos\4to\APKs\dron-testeo.apk`.
  2. Limpie `app-control-uav\www\`, copie `www-oficial\*` en `www\`, ejecute `npx cap sync android`, compile `.\gradlew.bat assembleOficialDebug` y copie el resultado a `C:\Dev\Control Dron\Tramos\4to\APKs\dron-oficial.apk`.
- Ejecutar `compilar-dos-apks.ps1` y verificar que ambos APK compilen con `BUILD SUCCESSFUL`, tengan ~50–65 MB (confirmando Vosk + canciones adentro) y distintos `applicationId`.

---

## 6. Informe Técnico (`C:\Dev\Control Dron\Tramos\4to\Informe\informe-4.2.md`)
Documentar de forma clara y concisa:
1. Cómo se eliminó el bucle infinito de voz en `VoskVoicePlugin.java` + JS y el cambio de `"Firulais"` a `"Dron"`.
2. Cómo funciona la memoria de potencia previa durante los dos bailes (`sacamos_cinco` y `que_te_vale`) tanto en Testeo como en Oficial con MPU-6050.
3. Tabla resumen de los 2 paquetes entregados (rutas exactas de los 2 `.ino`, rutas y tamaños de los 2 `.apk`, nombres de red Wi-Fi, claves e IPs).
4. Lista de verificación rápida para subir cada `.ino` en Arduino IDE y probar ambos APK instalados a la vez en el celular.