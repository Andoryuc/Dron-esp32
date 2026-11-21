# INFORME TÉCNICO 4.2 — Dos Firmwares ESP32 (Testeo y Oficial con MPU-6050) + Dos APK Co-Instalables con Voz Offline `"Dron"`

## 1. Eliminación del Bucle Infinito de Voz y Cambio a `"Dron"`

### 1.1 Verificación del Vocabulario Vosk (`vosk-model-small-es-0.42`)
Al inspeccionar `app-control-uav/android/app/src/main/assets/vosk-model-es/graph/` se comprobó que el modelo no incluye un archivo `words.txt` en texto plano, sino grafos OpenFST compilados (`Gr.fst` de 21,818,215 bytes y `HCLr.fst` de 12,226,498 bytes). Al consultar la tabla de símbolos de `Gr.fst`:
- **Presentes en `Gr.fst`:** `dron`, `drone`, `drones`, `tron`, `bron`, `don`, `enciende`, `apaga`, `para`, `aterriza`, `volando`, `seguro`, `sacamos`, `cinco`, `vale`, `monda`, `estas`, `estás`, `que`, `qué`.
- **Ausentes de `Gr.fst`:** `drom`, `apagate`, `apágate`, `mondá`.

Se mantuvo Vosk en modo español abierto (`useGrammar = false` en `VoskVoicePlugin.java`) para capturar `"dron"`, sus alias fonéticos (`dron, drone, drones, tron, bron, drom, don dron`), calibraciones del usuario y variantes transcritas reales (`apaga te`, `apaga`, etc.), eliminando por completo toda referencia a `"Firulais"` en Java, HTML, JavaScript, textos TTS y `localStorage`.

### 1.2 Correcciones en `VoskVoicePlugin.java` y Lógica JS Compartida
El bucle infinito previo ocurría porque `handleVoiceResult()` ejecutaba comandos sobre transcripciones parciales (`onPartialResult`), el `MediaPlayer` o el TTS no reseteaban el búfer del reconocedor al terminar, y la confirmación de apagado podía re-dispararse si el TTS volvía a captarse por el micrófono.

Se aplicó una solución de raíz en ambas capas:
1. **Prohibido ejecutar comandos en parciales (`isFinal === false`):** en `www-testeo/index.html` y `www-oficial/index.html`, `onPartialResult` solo muestra el texto con etiqueta `[parcial]` en pantalla y retorna inmediatamente; la clasificación y ejecución ocurren únicamente en `onResult` / `onFinalResult` (`isFinal === true`).
2. **Bandera atómica nativa `isAudioBusy` + pausa real de `SpeechService`:** en `VoskVoicePlugin.java`, `pauseSpeechImmediate()` activa `isAudioBusy = true` y ejecuta `speechService.setPause(true)` antes de hablar (`TextToSpeech.QUEUE_FLUSH`) o reproducir música; además, `emitVoiceResult()` descarta cualquier callback residual si `isAudioBusy || ttsSpeaking || isSongPlaying || System.currentTimeMillis() < muteUntilMs`.
3. **Limpieza de búfer y enfriamiento anti-eco (`scheduleResumeAfterCooldown`):**
   - Al terminar el TTS (`onDone`, `onError`, `onStop` o watchdog), se llama `activeRecognizer.reset()`, se mantiene la escucha pausada durante **600 ms** (`TTS_COOLDOWN_MS = 600L`), se vuelve a resetear el reconocedor y solo entonces se reanuda `speechService.setPause(false)` y se emite `ttsEnd`.
   - Al terminar una canción (`OnCompletionListener` / `OnErrorListener`), se llama `activeRecognizer.reset()`, se espera **1200 ms** (`SONG_COOLDOWN_MS = 1200L`), y recién entonces se reanuda `speechService.setPause(false)` y se emite `songEnded`.
4. **Reproducción única garantizada:** en `playSong()`, si `isSongPlaying || mediaPlayer != null` la llamada se ignora inmediatamente (`reason: "already_playing"`), y el reproductor se configura explícitamente con `mp.setLooping(false)`.
5. **Anti-doble disparo y ventana `AWAITING_OFF_CONFIRM`:** se aplicó `VOICE_COOLDOWN_MS = 1800` ms en JS tras cada comando; en estado `AWAITING_OFF_CONFIRM` (ventana de **8 s** tras *"¿Estás seguro?"*), solo se acepta `"Dron, estoy seguro, apágate"` (y sus alias de confirmación), ignorando repeticiones de `"dron apaga"` sin re-preguntar y cancelando silenciosamente al vencer los 8 s.

---

## 2. Memoria de Potencia Previa en los Bailes (`sacamos_cinco` y `que_te_vale`)

En ambas aplicaciones (`www-testeo/index.html` y `www-oficial/index.html`) se implementó la instantánea `preDancePower` justo al iniciar `"Dron, sacamos cinco"` (14 s) o `"Dron, qué te vale"` (22 s):

1. **Si estaba detenido (`0%`):**
   - Toma `danceBasePct` (configurable, por defecto `45%`) como base de demostración y `danceMinPct` (`20%` por defecto) como piso mínimo.
   - Al terminar la canción (o si `mediaPlayer` concluye), desciende suavemente en ~400 ms hasta `0%` y envía corte final (`/stop` en Testeo; `DANCE_END` con `thr = 0` en Oficial).
2. **Si ya estaba volando / con potencia activa (`preDancePower > 0`):**
   - Usa `preDancePower` como potencia base del baile y calcula un piso seguro dinámico para los bajoncitos bruscos (tramos `5.2–11.4 s` y `15.6–21.8 s` de `que_te_vale`):
     `floor = Math.max(danceMinPct, Math.round(preDancePower - amp * 1.35))`
     evitando que las hélices bajen a `0%` en pleno vuelo.
   - Al terminar la canción, **restaura suavemente en ~400 ms la potencia exacta previa (`preDancePower`)** sin apagar los motores y conservando `modoVuelo` si estaba activo.
3. **En Oficial (`dron_oficial_mpu6050.ino`):**
   - En modo **Estabilizado (`STAB` con MPU-6050)**, la app traduce cada frame coreográfico en `{"cmd":"DANCE_STAB","thr":..,"pitch":..,"roll":..}` a ~16 Hz; el lazo PID a 100 Hz ejecuta la coreografía manteniendo el dron nivelado sin volcarse.
   - En modo **Directo (`DIRECT`)**, envía `{"cmd":"DANCE_PWM","m1":..,"m2":..,"m3":..,"m4":..}`.
   - Al finalizar, `{"cmd":"DANCE_END","thr":preDancePower.thr}` devuelve el control normal a la palanca vertical de acelerador (sincronizada visualmente) manteniendo el vuelo si `thr > 0`.
4. **Bloqueo manual durante baile:** cualquier toque sobre los controles abre el modal **`¿Seguro que quieres deshabilitar el baile? [SÍ / NO]`**. Confirmar `SÍ` desde un control normal detiene el audio y restaura `preDancePower`; únicamente el botón rojo de emergencia (`⛔ APAGAR TODO (0%)` / `⛔ KILL`) corta a `0%`.

---

## 3. Resumen de los Dos Paquetes Entregados

| Elemento | Paquete 1 — Dron Testeo (Banco sin MPU) | Paquete 2 — Dron Oficial (Vuelo con MPU-6050 + PID) |
| :--- | :--- | :--- |
| **Firmware ESP32 (`.ino`)** | `C:\Dev\Control Dron\Tramos\4to\esp32_test\prueba_motores_voz.ino` | `C:\Dev\Control Dron\Tramos\4to\esp32_oficial\dron_oficial_mpu6050\dron_oficial_mpu6050.ino` |
| **Librerías ESP32** | Solo `<WiFi.h>` y `<WebServer.h>` (sin `PROGMEM` HTML) | Cero externas: `<WiFi.h>`, `<Wire.h>`, `<mbedtls/sha1.h>`, `<mbedtls/base64.h>` (sin `PROGMEM` HTML) |
| **Red Wi-Fi AP / Clave** | `UDES_MOTORES_TEST` / `12345678` (Canal 1) | `UDES_UAV_CONTROL` / `12345678` (Canal 1) |
| **IP / Protocolo** | `http://192.168.4.1` (HTTP + CORS: `/`, `/set`, `/stop`, `/seq`, `/ramp`, `/status`) | `ws://192.168.4.1:81` (WebSocket RFC6455 nativo a 50 Hz + telemetría ~33 Hz) |
| **Pines Motores IRFZ44N** | `M1=25 (CW)`, `M2=26 (CCW)`, `M3=27 (CCW)`, `M4=14 (CW)` (2.5 kHz, 10 bits) | `M1_FL=25 (CW)`, `M2_FR=26 (CCW)`, `M3_RL=27 (CCW)`, `M4_RR=14 (CW)` + I2C `SDA=21, SCL=22` |
| **APK Android (`.apk`)** | `C:\Dev\Control Dron\Tramos\4to\APKs\dron-testeo.apk` | `C:\Dev\Control Dron\Tramos\4to\APKs\dron-oficial.apk` |
| **Tamaño APK compilado** | **56.86 MB** | **56.86 MB** |
| **`applicationId` / Nombre** | `com.udes.drontesteo` / **`Dron Testeo`** | `com.udes.dronoficial` / **`Dron Oficial`** |
| **Orientación / Interfaz** | `unspecified` (`app-control-uav/www-testeo/`) | `sensorLandscape` en `100dvh` (`app-control-uav/www-oficial/`) |

> **Nota técnica Gradle:** Android Gradle Plugin 8.2.1 rechaza cualquier nombre de `productFlavor` que comience por `test` (`ProductFlavor names cannot start with 'test'`). Por ello, el flavor de testeo se declaró como `drontesteo` en `app-control-uav/android/app/build.gradle` apuntando su `sourceSet` de recursos a `src/testeo/res`, conservando intactos `applicationId = "com.udes.drontesteo"`, el nombre visible `Dron Testeo` y la salida `dron-testeo.apk`.

- **Script de compilación dual:** `C:\Dev\Control Dron\compilar-dos-apks.ps1` (ejecuta limpieza de `www/` y `assets/public/`, `npx cap sync android`, `assembleDrontesteoDebug`, `assembleOficialDebug` y verificación de `package:` y `application-label:` mediante `aapt2`).

---

## 4. Lista de Verificación Rápida (Arduino IDE + Celular)

### 4.1 Cargar los Firmwares en Arduino IDE
1. Seleccionar placa **ESP32 Dev Module** (compatible con ESP32 Arduino Core 2.x y 3.x; no requiere instalar librerías externas).
2. **Para pruebas de banco sin sensor:** abrir `C:\Dev\Control Dron\Tramos\4to\esp32_test\prueba_motores_voz.ino`, compilar y subir al ESP32; verificar en Monitor Serial (`115200` baud) la red `UDES_MOTORES_TEST` en `192.168.4.1`.
3. **Para vuelo con MPU-6050:** conectar `SDA -> GPIO 21` y `SCL -> GPIO 22` (`0x68`), dejar el dron nivelado sobre superficie plana al energizar para las 200 muestras de calibración inicial, y subir `C:\Dev\Control Dron\Tramos\4to\esp32_oficial\dron_oficial_mpu6050\dron_oficial_mpu6050.ino`. Verificar `WS URI: ws://192.168.4.1:81` y `IMU HW: OK` (si el sensor está desconectado, el firmware arranca sin bloquearse en modo `DIRECT`).

### 4.2 Probar Ambos APK Co-Instalados en el Mismo Teléfono
1. Copiar e instalar **ambos** archivos (`dron-testeo.apk` y `dron-oficial.apk`) en el mismo celular Android; aparecerán dos íconos independientes (**Dron Testeo** y **Dron Oficial**).
2. Abrir cada app, conceder permiso de **Micrófono** al tocar **`🎙️ TOCAR Y HABLAR ("DRON")`** y verificar que el TTS español offline responda una sola vez sin re-disparar comandos por eco.
3. Probar la calibración con **`🧪 Calibrar 'Dron'`**, verificar el bloqueo en vuelo (`"Dron, estás volando"` o superar el umbral Helio), confirmar que `"Dron, apaga"` en tierra espera 8 s solo por `"Dron, estoy seguro, apágate"`, y comprobar que `"Dron, sacamos cinco"` y `"Dron, qué te vale"` suenan una única vez restaurando la potencia previa al finalizar.
4. En **Dron Oficial**: conectar al Wi-Fi `UDES_UAV_CONTROL` (`12345678`), comprobar la orientación horizontal fija, verificar que el joystick izquierdo (`Pitch/Roll`) regresa al centro al soltar y la palanca vertical derecha de acelerador (`0%–100%`) mantiene su posición y se sincroniza automáticamente con `"Dron, enciende"`, `"Dron, aterriza"` y los bailes.
