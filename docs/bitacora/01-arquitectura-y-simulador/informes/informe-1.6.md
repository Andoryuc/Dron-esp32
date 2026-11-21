# INFORME TÉCNICO 1.6 — APK Android con Reconocimiento de Voz 100% Offline (Vosk Embebido) para Control Wi-Fi del ESP32

**Proyecto:** Control de Dron Cuadricóptero UAV — Universidad de Santander (UDES)  
**Requerimiento origen:** [`pedido-1.6.md`](file:///C:/Dev/Control%20Dron/Tramos/1ro/Pedido/pedido-1.6.md)  
**Firmware ESP32 objetivo (sin modificaciones):** `prueba_motores_voz.ino` (AP Wi-Fi `UDES_MOTORES_TEST`, `http://192.168.4.1`)  
**Entregable APK compilado:** [`uav-control.apk`](file:///C:/Dev/Control%20Dron/app-control-uav/www/uav-control.apk) (`60,936,583` bytes / `58.11 MB`)

---

## 1. Resumen Ejecutivo y Alcance Cumplido

Se integró el motor de reconocimiento de voz offline **Vosk (`vosk-android:0.3.47`)** junto con el modelo acústico/lingüístico de español **`vosk-model-small-es-0.42`** directamente dentro del paquete Android `uav-control.apk`, eliminando por completo la dependencia de Google Speech, Chrome y conexión a internet.

- **Firmware intacto:** No se modificó ningún archivo del firmware ESP32; la aplicación se comunica por HTTP directo hacia `http://192.168.4.1`.
- **Comunicación HTTP sin bloqueos CORS:** Se activó `CapacitorHttp` nativo en Capacitor 6 para enrutar las peticiones hacia `http://192.168.4.1` desde Android sin restricciones de origen del WebView.
- **Gramática dinámica configurable en el teléfono:** El usuario puede editar y guardar en `localStorage` las frases de encendido y apagado sin recompilar el APK.
- **Compilación limpia sin APK anidado:** Se actualizó [`compilar-apk.ps1`](file:///C:/Dev/Control%20Dron/compilar-apk.ps1) para purgar cualquier `uav-control.apk` previo en `www/` y `assets/public/` antes de `npx cap sync android`, obteniendo `BUILD SUCCESSFUL` con un paquete final de `58.11 MB`.

---

## 2. Modelo Offline de Español (`vosk-model-small-es-0.42`)

Se descargó el paquete oficial `https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip` (`37.97 MB` comprimidos) y se extrajo de forma aplanada dentro de `C:\Dev\Control Dron\app-control-uav\android\app\src\main\assets\vosk-model-es\`, sin carpeta raíz duplicada.

Verificación tras la descompresión:
- **Subcarpetas y archivo raíz directos en `assets/vosk-model-es/`:** `am`, `conf`, `graph`, `ivector`, `README`
- **Archivos clave verificados:** `conf\model.conf` (`True`) y `am\final.mdl` (`True`)
- **Total descomprimido:** `14` archivos, `57.49 MB`

---

## 3. Configuración Android y Capacitor

### 3.1 [`capacitor.config.json`](file:///C:/Dev/Control%20Dron/app-control-uav/capacitor.config.json)
Se conservó `server.androidScheme = "http"` y `server.cleartext = true`, añadiendo el bloque de plugin nativo HTTP de Capacitor 6:
```json
  "plugins": {
    "CapacitorHttp": {
      "enabled": true
    }
  }
```

### 3.2 [`build.gradle`](file:///C:/Dev/Control%20Dron/app-control-uav/android/app/build.gradle)
En el bloque `dependencies` se añadieron las dependencias de JNA y Vosk para Android:
- `implementation 'net.java.dev.jna:jna:5.13.0@aar'`
- `implementation 'com.alphacephei:vosk-android:0.3.47@aar'`

### 3.3 [`AndroidManifest.xml`](file:///C:/Dev/Control%20Dron/app-control-uav/android/app/src/main/AndroidManifest.xml)
- `android:usesCleartextTraffic="true"` activo en `<application>`.
- `android:screenOrientation="unspecified"` en `<activity>` (`MainActivity`) para operar cómodamente tanto en orientación vertical como horizontal.
- Permisos declarados: `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `VIBRATE`, `RECORD_AUDIO` y `MODIFY_AUDIO_SETTINGS`.

---

## 4. Plugin Nativo Capacitor: `VoskVoicePlugin.java` y `MainActivity.java`

### 4.1 Registro en [`MainActivity.java`](file:///C:/Dev/Control%20Dron/app-control-uav/android/app/src/main/java/edu/udes/uav/gcs/MainActivity.java)
Se registró el plugin en el paquete `edu.udes.uav.gcs` **antes** de `super.onCreate(savedInstanceState)`:
```java
registerPlugin(VoskVoicePlugin.class);
super.onCreate(savedInstanceState);
```

### 4.2 Implementación en [`VoskVoicePlugin.java`](file:///C:/Dev/Control%20Dron/app-control-uav/android/app/src/main/java/edu/udes/uav/gcs/VoskVoicePlugin.java)
- **Anotación del plugin:** `@CapacitorPlugin(name = "VoskVoice", permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) })`.
- **Inicialización asíncrona (`initModel`):**
  - Se ejecuta en un `ExecutorService` (`Executors.newSingleThreadExecutor()`).
  - Verifica si `getContext().getFilesDir()/vosk-model-es` contiene un modelo válido (`conf/model.conf`, `am/final.mdl`, `graph`, `ivector`); si falta o está incompleto, limpia y copia recursivamente `assets/vosk-model-es` mediante `AssetManager`.
  - Instancia `new Model(modelDir.getAbsolutePath())` y emite el evento `voiceState` con `{ state: "ready" }` (o `{ state: "error", message: "..." }` ante fallo).
- **Escucha con gramática dinámica (`startListening` / `stopListening`):**
  - Verifica `PermissionState.GRANTED` sobre el alias `"microphone"`; si falta, solicita `RECORD_AUDIO` automáticamente con `requestPermissionForAlias("microphone", call, "microphonePermsCallback")`.
  - Lee el arreglo opcional `phrases` desde JS, normaliza espacios/minúsculas eliminando duplicados y añade siempre `"[unk]"` al final. Si no recibe frases válidas, usa la gramática por defecto: `["dron enciende", "enciende", "dron apaga", "apaga", "para", "detener", "[unk]"]`.
  - Inicia `new Recognizer(model, 16000.0f, grammarJson)` y `new SpeechService(recognizer, 16000.0f)` con `RecognitionListener`.
  - En `onPartialResult`, `onResult` y `onFinalResult`, extrae `"partial"` o `"text"` del JSON de Vosk, descarta cadenas vacías o `"[unk]"` y emite `voiceResult` con `{ text: "...", isFinal: true/false }` hacia JavaScript.
  - En `stopListening()` y `handleOnDestroy()`, detiene y apaga `SpeechService` (`stop()` y `shutdown()`) antes de cerrar `Recognizer` y `Model`, previniendo fallos de acceso en JNI.

---

## 5. Interfaz Móvil Conectada al ESP32 (`www/index.html`)

Se reemplazó [`index.html`](file:///C:/Dev/Control%20Dron/app-control-uav/www/index.html) por una interfaz autónoma (HTML + CSS + JS inline, sin simulador ni Web Speech API) adaptada a vertical y horizontal:

- **Destino fijo Wi-Fi:** `const ESP_BASE = "http://192.168.4.1";`, invocando `/set?m1=..&m2=..&m3=..&m4=..`, `/stop`, `/seq`, `/ramp` y `/status` a través de `Capacitor.Plugins.CapacitorHttp.get` (con respaldo `fetch` para pruebas locales).
- **Tarjeta de Voz Offline (Vosk):**
  - Indicador en tiempo real (`⏳ Cargando modelo offline...` -> `✅ Vosk Offline Listo` -> `🎙️ Escuchando (Offline)`).
  - Selector de potencia de encendido por voz: `25%`, `40%` (por defecto), `60%`, `80%`, `100%` (persistido en `localStorage`).
  - Botón principal **`🎙️ TOCAR Y HABLAR (OFFLINE)`** que conmuta `VoskVoice.startListening({ phrases: listaCombinada })` y `VoskVoice.stopListening()`.
  - Visor en pantalla (`🎧 Detectado: ...`) y barra de estado de acción.
  - Sección desplegable **`⚙️ Editar frases de voz`** con campos editables para frases de **ENCENDER** (`dron enciende, enciende`) y **APAGAR** (`dron apaga, apaga, para, detener`), botón **Guardar frases** (persistencia en `localStorage` bajo `udes_vosk_phrases_v1` y actualización en caliente si está escuchando) y **Restaurar defecto**.
  - Disparo instantáneo con debounce de `800 ms` y prioridad de seguridad para **APAGAR**:
    - Frase de encendido -> `/set?m1=PCT&m2=PCT&m3=PCT&m4=PCT`, actualiza todos los sliders/tarjetas y muestra `✅ Motores encendidos al PCT%`.
    - Frase de apagado -> `/stop`, lleva los sliders a `0%` y muestra `⛔ Motores apagados (0%)`.
- **Controles manuales completos:**
  - Botón rojo fijo en cabecera **`⛔ APAGAR TODO (0%)`**.
  - Slider maestro **`TODOS LOS MOTORES`** (`0–100%`).
  - 4 tarjetas individuales (`M1 GPIO 25`, `M2 GPIO 26`, `M3 GPIO 27`, `M4 GPIO 14`) con barra y slider independiente.
  - Pruebas automáticas: **`▶ Test 1 → 2 → 3 → 4 (35%)`** (`/seq`, timeout `12 s`) y **`📈 Rampa Suave (0→100→0%)`** (`/ramp`, timeout `15 s`).

---

## 6. Compilación Final y Prevención de APK Duplicado

En [`compilar-apk.ps1`](file:///C:/Dev/Control%20Dron/compilar-apk.ps1) se agregaron:
1. Limpieza previa de `app-control-uav\www\uav-control.apk` y `app-control-uav\android\app\src\main\assets\public\uav-control.apk` antes de `npx cap sync android`.
2. Validación de `$LASTEXITCODE` tras `npx cap sync android` y `.\gradlew.bat assembleDebug --no-daemon`.

**Resultado observado de compilación:**
- `npx cap sync android`: completado en `0.19s` (`Found 2 Capacitor plugins for android: @capacitor/haptics@6.0.3, @capacitor/status-bar@6.0.3`).
- `.\gradlew.bat assembleDebug --no-daemon`: **`BUILD SUCCESSFUL in 47s`** (`136 actionable tasks: 39 executed, 97 up-to-date`).
- Librerías nativas empaquetadas en el APK: `libjnidispatch.so` y `libvosk.so`.
- Archivo final generado: [`uav-control.apk`](file:///C:/Dev/Control%20Dron/app-control-uav/www/uav-control.apk) — **`60,936,583` bytes (`58.11 MB`)**.

---

## 7. Guía Rápida de Prueba en Campo (Sin Hélices primero)

1. Instalar [`uav-control.apk`](file:///C:/Dev/Control%20Dron/app-control-uav/www/uav-control.apk) en el teléfono Android (desinstalar o reemplazar la versión previa si tenía distinta firma o caché).
2. Abrir la app **sin conexión a internet** (incluso en modo avión con Wi-Fi local) y esperar a que el indicador pase de `⏳ Cargando modelo offline...` a `✅ Vosk Offline Listo` (la primera apertura copia los `57.49 MB` al almacenamiento interno de la app; las aperturas siguientes cargan directo desde `filesDir`).
3. Conectar el celular a la red Wi-Fi del ESP32 **`UDES_MOTORES_TEST`** (`http://192.168.4.1`) y verificar el chip **`🟢 ESP32 Conectado · 192.168.4.1`**.
4. Con el dron asegurado y sin hélices, probar:
   - Controles manuales (`M1`–`M4`, slider maestro, `▶ Test 1 → 2 → 3 → 4 (35%)` y `⛔ APAGAR TODO (0%)`).
   - Pulsar **`🎙️ TOCAR Y HABLAR (OFFLINE)`**, aceptar el permiso de micrófono la primera vez, elegir potencia (`40%` por defecto) y pronunciar *"dron enciende"* -> *"dron apaga"* / *"apaga"* / *"para"*.
   - Desplegar **`⚙️ Editar frases de voz`** para agregar o modificar palabras personalizadas y pulsar **Guardar frases**.
