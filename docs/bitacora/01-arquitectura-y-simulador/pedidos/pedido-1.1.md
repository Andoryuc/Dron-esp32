# PEDIDO 1.1: Corrección de Layout/Scroll de Joysticks, Tráfico Wi-Fi en Android y Generador Automático de APK

## Problemas a Resolver
1. En pantallas móviles horizontales, la cabecera empuja los joysticks hacia abajo cortándolos y el bloqueo de `overflow` impide hacer scroll para acomodarlos.
2. Al empaquetar como `.apk` nativo con Capacitor, `window.location.hostname` pasa a ser `localhost` en lugar de la IP del servidor Wi-Fi, y Android bloquea conexiones `ws://` si no está activo `usesCleartextTraffic`.
3. El entorno Windows no tiene `JAVA_HOME` ni `ANDROID_HOME` configurados globalmente para ejecutar `gradlew.bat assembleDebug`, y se requiere descargar el `.apk` directamente al teléfono por Wi-Fi.

## Cambios Requeridos

### 1. Interfaz Móvil y Ergonomía de Joysticks (`app-control-uav/www/index.html`)
- Rediseñar el layout horizontal (`Landscape`) para que quepa en el 100% del alto visible (`100dvh`) sin cortar los joysticks:
  - Compactar la barra superior de telemetría a una sola fila delgada (`44px` de alto máximo).
  - Permitir scroll vertical suave en el contenedor general cuando el usuario toque fuera de la zona de los joysticks, y agregar un botón **"⛶ PANTALLA COMPLETA / FIJAR MANDOS"** que ejecute `document.documentElement.requestFullscreen()` y encaje los dos joysticks centrados a la altura exacta de la pantalla.
  - Agregar en la barra superior un selector/input compacto de IP del enlace Wi-Fi con autodetección (probando automáticamente `192.168.39.42:81`, la IP del servidor actual y `192.168.4.1:81` del ESP32, permitiendo editarla con un toque y guardándola en `localStorage`).
  - Agregar un botón **"📲 DESCARGAR APK"** en la barra superior cuando se abra desde navegador que descargue `/uav-control.apk`.

### 2. Configuración Nativa Android para Wi-Fi (`app-control-uav/`)
- En `capacitor.config.json`: configurar `"server": { "androidScheme": "http", "cleartext": true }`.
- En `android/app/src/main/AndroidManifest.xml`:
  - Añadir `android:usesCleartextTraffic="true"` en el tag `<application>`.
  - Configurar `android:screenOrientation="sensorLandscape"` en el `<activity>` principal para que el `.apk` abra siempre en horizontal a pantalla completa sin barras del sistema.

### 3. Script Automatizado de Compilación APK (`compilar-apk.ps1`) y Descarga por Wi-Fi (`modo-wifi.js`)
- Crear `C:\Dev\Control Dron\compilar-apk.ps1` para que de forma 100% desatendida en PowerShell:
  1. Verifique si existen JDK 17 y Android Command-Line Tools; si no están instalados, descargue las versiones portables oficiales (`.zip`) dentro de `C:\Dev\Control Dron\.build-tools` (OpenJDK 17 Temurin portable + Android `commandlinetools-win`), configure `JAVA_HOME` y `ANDROID_HOME` en la sesión actual e instale `platforms;android-34` y `build-tools;34.0.0` aceptando licencias automáticamente.
  2. Ejecute `npx cap sync android` y `.\gradlew.bat assembleDebug` dentro de `app-control-uav/android`.
  3. Copie el archivo `app-debug.apk` resultante a `C:\Dev\Control Dron\app-control-uav\www\uav-control.apk`.
- Actualizar `C:\Dev\Control Dron\modo-wifi.js` para servir el archivo `.apk` con cabecera `Content-Type: application/vnd.android.package-archive` en la ruta `/apk` y `/uav-control.apk`, e imprimir en consola la IP actual detectada (`192.168.39.42`).