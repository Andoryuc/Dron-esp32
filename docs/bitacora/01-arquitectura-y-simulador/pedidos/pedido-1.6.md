# PEDIDO 1.6: APK Android con Reconocimiento de Voz 100% Offline (Vosk Embebido) para Control Wi-Fi del ESP32

## Objetivo
Empaquetar el motor libre **Vosk (`vosk-android`)** junto con el modelo de español (`vosk-model-small-es-0.42`) directamente dentro de `uav-control.apk`, con **gramática cerrada configurable desde la interfaz del APK**, eliminando por completo la dependencia de Google Speech, Chrome y conexión a internet.

El APK se conectará por Wi-Fi local al firmware ya cargado en el ESP32 (`prueba_motores_voz.ino`, red `UDES_MOTORES_TEST`, IP `http://192.168.4.1`), **sin modificar el código del ESP32**.

## Alcance Estricto
Trabajar únicamente sobre:
1. `C:\Dev\Control Dron\app-control-uav\capacitor.config.json`
2. `C:\Dev\Control Dron\app-control-uav\android\app\build.gradle`
3. `C:\Dev\Control Dron\app-control-uav\android\app\src\main\AndroidManifest.xml`
4. `C:\Dev\Control Dron\app-control-uav\android\app\src\main\assets\vosk-model-es\` (modelo descargado)
5. `C:\Dev\Control Dron\app-control-uav\android\app\src\main\java\...\VoskVoicePlugin.java` y `MainActivity.java`
6. `C:\Dev\Control Dron\app-control-uav\www\index.html`
7. `C:\Dev\Control Dron\compilar-apk.ps1` (evitar que un `.apk` viejo dentro de `www/` se vuelva a copiar en `assets/public`)
8. `C:\Dev\Control Dron\Tramos\1ro\Informes\informe-1.6.md`

---

## Cambios Requeridos

### 1. Descarga y Empaquetado del Modelo de Español Offline (`vosk-model-small-es-0.42`)
- Descargar el modelo oficial liviano de español (~39 MB):
  `https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip`
- Descomprimir su contenido de forma limpia dentro de:
  `C:\Dev\Control Dron\app-control-uav\android\app\src\main\assets\vosk-model-es\`
  verificando que las subcarpetas `am`, `conf`, `graph` e `ivector` queden directamente dentro de `assets/vosk-model-es/` sin carpetas duplicadas anidadas.

### 2. Dependencias Gradle y Configuración Android (`app-control-uav/android/`)
- En `android/app/build.gradle` (bloque `dependencies`), agregar estas dos líneas:
  - `implementation 'net.java.dev.jna:jna:5.13.0@aar'`
  - `implementation 'com.alphacephei:vosk-android:0.3.47@aar'`
- En `android/app/src/main/AndroidManifest.xml`:
  - Asegurar `android:usesCleartextTraffic="true"` en `<application>`.
  - Asegurar los permisos: `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `RECORD_AUDIO` y `MODIFY_AUDIO_SETTINGS`.
  - Configurar `android:screenOrientation="unspecified"` en `<activity>` para poder usarlo cómodamente en vertical u horizontal.
- En `app-control-uav/capacitor.config.json`:
  - Configurar `"server": { "androidScheme": "http", "cleartext": true }`.
  - Habilitar el plugin nativo HTTP de Capacitor 6 para evitar bloqueos CORS al consultar `http://192.168.4.1` desde el WebView: `"plugins": { "CapacitorHttp": { "enabled": true } }`.

### 3. Plugin Nativo Capacitor en Java (`VoskVoicePlugin.java` + `MainActivity.java`)
- Revisar el `package` real de `MainActivity.java` y crear `VoskVoicePlugin.java` en ese mismo paquete, registrándolo en `MainActivity.java` con `registerPlugin(VoskVoicePlugin.class);` **antes** de `super.onCreate(savedInstanceState);`.
- Implementar en `VoskVoicePlugin.java`:
  - Anotación `@CapacitorPlugin(name = "VoskVoice", permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) })`.
  - **Desempaquetado automático al iniciar (`initModel`):** En un hilo secundario (`ExecutorService`), copiar recursivamente `assets/vosk-model-es` hacia `getContext().getFilesDir()/vosk-model-es` solo si aún no existe (o si falta `conf/model.conf`), cargar `new Model(modelDir.getAbsolutePath())` y emitir evento `voiceState` con `{ state: "ready" }` (o `{ state: "error", message: "..." }`).
  - **Reconocimiento con Gramática Dinámica (`startListening` / `stopListening`):**
    - Solicitar permiso `RECORD_AUDIO` automáticamente si no ha sido otorgado.
    - Leer un parámetro opcional `phrases` (arreglo JSON de strings enviado desde JavaScript) para armar la gramática de Vosk agregando siempre `"[unk]"` al final. Si no viene `phrases`, usar por defecto: `["dron enciende", "enciende", "dron apaga", "apaga", "para", "detener", "[unk]"]`.
    - Crear `new Recognizer(model, 16000.0f, grammarJson)` e iniciar `new SpeechService(recognizer, 16000.0f)` con `RecognitionListener`.
    - En `onPartialResult` y `onResult`: extraer el texto del JSON de Vosk (`"partial"` o `"text"`), ignorar cadenas vacías o `"[unk]"` y emitir evento `voiceResult` con `{ text: "...", isFinal: true/false }` hacia JavaScript.
    - En `stopListening()` y `handleOnDestroy()`: detener y liberar `SpeechService` limpiamente.

### 4. Interfaz Móvil Conectada al ESP32 (`app-control-uav/www/index.html`)
- Reemplazar `www/index.html` por la interfaz del **Banco de Pruebas de 4 Motores + Voz Offline Vosk** (sin simulador ni código de Google Speech):
  - **Destino fijo por Wi-Fi:** `const ESP_BASE = "http://192.168.4.1";` usando las rutas existentes de `prueba_motores_voz.ino`: `/set?m1=..&m2=..&m3=..&m4=..`, `/stop`, `/seq`, `/ramp` y `/status`.
  - **Tarjeta de Voz Offline (Vosk):**
    - Indicador de carga del modelo (`⏳ Cargando modelo offline...` -> `✅ Vosk Offline Listo`).
    - Selector de potencia para el comando de encendido (`25%`, `40%` por defecto, `60%`, `80%`, `100%`).
    - Botón grande **`🎙️ TOCAR Y HABLAR (OFFLINE)`** que llama a `window.Capacitor.Plugins.VoskVoice.startListening({ phrases: listaCombinada })` y detiene si se vuelve a tocar.
    - Visor en pantalla de lo que detecta Vosk en tiempo real.
    - **Sección desplegable `"⚙️ Editar frases de voz"`** (guardada en `localStorage`):
      - Campo 1 — Frases para ENCENDER (por defecto: `dron enciende, enciende`).
      - Campo 2 — Frases para APAGAR (por defecto: `dron apaga, apaga, para, detener`).
      - Botón **"Guardar frases"** para que el usuario pueda añadir o cambiar frases desde el celular sin recompilar.
    - Lógica de disparo instantáneo (con debounce de `800 ms`):
      - Si el texto detectado coincide con alguna frase de ENCENDER -> envía `/set?m1=PCT&m2=PCT&m3=PCT&m4=PCT` al ESP32, actualiza sliders/tarjetas y muestra `✅ Motores encendidos al PCT%`.
      - Si coincide con alguna frase de APAGAR -> envía `/stop`, pone sliders en `0%` y muestra `⛔ Motores apagados (0%)`.
  - **Controles manuales completos:** Botón rojo **`⛔ APAGAR TODO (0%)`**, slider maestro (`TODOS LOS MOTORES`), 4 tarjetas individuales (`M1 GPIO 25`, `M2 GPIO 26`, `M3 GPIO 27`, `M4 GPIO 14`) y botones **`▶ Test 1 → 2 → 3 → 4 (35%)`** y **`📈 Rampa Suave (0→100→0%)`**.

### 5. Prevención de APK Duplicado y Compilación Final
- En `compilar-apk.ps1`, antes de ejecutar `npx cap sync android`, eliminar cualquier `app-control-uav\www\uav-control.apk` existente para evitar que Capacitor empaquete un APK viejo dentro del nuevo.
- Ejecutar `compilar-apk.ps1` hasta obtener `BUILD SUCCESSFUL` y verificar el tamaño final del archivo `C:\Dev\Control Dron\app-control-uav\www\uav-control.apk` (~50 a 65 MB incluyendo el modelo de español).
- Documentar todo en `C:\Dev\Control Dron\Tramos\1ro\Informes\informe-1.6.md`.