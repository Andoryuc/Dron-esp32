# INFORME TÉCNICO 1.1: Corrección de Ergonomía Landscape (100dvh), Tráfico Wi-Fi en Android (Cleartext) y Aprovisionamiento Automatizado de APK

## 1. Resumen de Problemas Resueltos
1. **Recorte de Joysticks y Bloqueo de Scroll en Pantallas Horizontales:** Se rediseñó la arquitectura CSS/HTML de la Estación de Control en Tierra (`app-control-uav/www/index.html` y `styles.css`) para ajustarse al `100%` del alto visible dinámico (`100dvh`). La barra superior de telemetría se compactó a una única fila de `44px` de alto máximo, los joysticks se dimensionan proporcionalmente (`min(200px, calc(100dvh - 104px), 33vw)`), se habilitó scroll vertical suave (`touch-action: pan-y`) fuera de los pads táctiles y se incorporó el botón **"⛶ PANTALLA COMPLETA / FIJAR MANDOS"** (`requestFullscreen()`).
2. **Conexión Wi-Fi WebSocket desde APK Nativo (`cleartext` e IP dinámica):** Se configuró `"androidScheme": "http"` y `"cleartext": true` en `capacitor.config.json`, así como `android:usesCleartextTraffic="true"` y `android:screenOrientation="sensorLandscape"` en `AndroidManifest.xml`. Además, se integró en la barra superior un selector/input compacto de IP con persistencia en `localStorage` y autodetección secuencial entre `192.168.39.42:81`, la IP del servidor actual y `192.168.4.1:81` (ESP32).
3. **Compilación Desatendida del `.apk` y Descarga Directa por Wi-Fi:** Se creó el script autónomo `C:\Dev\Control Dron\compilar-apk.ps1` que aprovisiona automáticamente OpenJDK 17 Temurin portable y Android Command-Line Tools (`platforms;android-34`, `build-tools;34.0.0`) dentro de `C:\Dev\Control Dron\.build-tools`, ejecuta `npx cap sync android` y `.\gradlew.bat assembleDebug`, y publica el ejecutable en `app-control-uav/www/uav-control.apk`. Asimismo, `modo-wifi.js` sirve el paquete con cabecera `Content-Type: application/vnd.android.package-archive` en `/apk` y `/uav-control.apk`.

---

## 2. Detalle Técnico de las Modificaciones

### 2.1. Ergonomía Landscape `100dvh`, Selector IP y Botón APK (`app-control-uav/www/`)
* **Archivos actualizados:**
  * `C:\Dev\Control Dron\app-control-uav\www\index.html`
  * `C:\Dev\Control Dron\app-control-uav\www\styles.css`
  * `C:\Dev\Control Dron\app-control-uav\www\app.js`
* **Características clave:**
  * **Cabecera Unificada (`44px`):** Agrupa en una sola línea horizontal el estado del enlace, RSSI en dBm, voltaje/actitud MPU6050, input de IP Wi-Fi editable con botón de rotación rápida (`⇄`), botón **"⛶ PANTALLA COMPLETA / FIJAR MANDOS"**, botón **"📲 DESCARGAR APK"** (`/uav-control.apk`) y el **KILL SWITCH**.
  * **Autodetección y Persistencia de IP (`localStorage`):** `app.js` almacena la dirección en `localStorage["udes_uav_wifi_host"]` y prueba automáticamente `192.168.39.42:81`, el host actual del navegador y `192.168.4.1:81`, evitando que el `.apk` empaquetado intente conectarse a `localhost:81`.

### 2.2. Configuración Nativa Android (`capacitor.config.json` y `AndroidManifest.xml`)
* **Archivos actualizados:**
  * `C:\Dev\Control Dron\app-control-uav\capacitor.config.json`:
    ```json
    "server": {
      "androidScheme": "http",
      "cleartext": true,
      "allowNavigation": ["*"]
    }
    ```
  * `C:\Dev\Control Dron\app-control-uav\android\app\src\main\AndroidManifest.xml`:
    * `android:usesCleartextTraffic="true"` añadido en `<application>` para permitir sockets `ws://` hacia `192.168.39.42:81` y `192.168.4.1:81`.
    * `android:screenOrientation="sensorLandscape"` añadido en `<activity android:name=".MainActivity">` junto con permisos de red y vibración háptica (`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `VIBRATE`).

### 2.3. Compilador Automatizado (`compilar-apk.ps1`) y Servidor de Descarga (`modo-wifi.js`)
* **Script de compilación (`C:\Dev\Control Dron\compilar-apk.ps1`):**
  1. Verifica o descarga automáticamente **OpenJDK 17 Temurin Portable** y **Android Command-Line Tools** en `C:\Dev\Control Dron\.build-tools`.
  2. Configura `JAVA_HOME`, `ANDROID_HOME` y `local.properties` en la sesión de PowerShell, acepta licencias e instala `platforms;android-34` y `build-tools;34.0.0`.
  3. Ejecuta `npx cap sync android` y `.\gradlew.bat assembleDebug --no-daemon`.
  4. Copia `app-debug.apk` hacia `C:\Dev\Control Dron\app-control-uav\www\uav-control.apk`.
* **Servidor Wi-Fi (`C:\Dev\Control Dron\modo-wifi.js`):**
  * Expone las rutas `/apk` y `/uav-control.apk` con cabecera `Content-Type: application/vnd.android.package-archive` y muestra en consola la IP principal detectada (`192.168.39.42`).

---

## 3. Instrucciones de Ejecución Rápida
1. **Generar el `.apk` de forma automática (PowerShell):**
   ```powershell
   cd "C:\Dev\Control Dron"
   powershell -ExecutionPolicy Bypass -File .\compilar-apk.ps1
   ```
2. **Iniciar el servidor Wi-Fi y emulador a 50 Hz:**
   ```powershell
   cd "C:\Dev\Control Dron"
   node modo-wifi.js
   ```
3. **Descargar o abrir en el teléfono Android:**
   * Abrir `http://192.168.39.42:8080` en el navegador del teléfono y tocar **"📲 DESCARGAR APK"** (o ingresar directamente a `http://192.168.39.42:8080/uav-control.apk`).
