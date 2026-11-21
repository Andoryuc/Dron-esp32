# INFORME TÉCNICO 5.0 — Reorganización Total, Limpieza, Renombrado de Tramos y Preparación de Repositorio GitHub

## 1. Resumen Ejecutivo

Se ejecutó la reorganización integral y limpieza del espacio de trabajo `C:\Dev\Control Dron\` conforme al **Pedido 5.0**, transformando el proyecto en un repositorio uniforme en `kebab-case`, libre de copias redundantes, archivos obsoletos y videos pesados, manteniendo intactas la lógica funcional de los dos firmwares ESP32, la app Android híbrida (`VoskVoicePlugin.java`, `www-oficial/`, `www-testeo/`), el visor 3D offline y el simulador 2D en PC, así como las herramientas locales de compilación en `.build-tools/`.

---

## 2. Árbol Final Real del Repositorio

```text
Control Dron/
├── .build-tools/                           [excluida en .gitignore — OpenJDK 17 + Android SDK 34]
├── .gitignore
├── LICENSE                                 [Licencia MIT 2026]
├── README.md
├── app-android/
│   ├── android/
│   │   ├── .gradle/                        [excluida en .gitignore]
│   │   ├── app/
│   │   │   ├── build/                      [excluida en .gitignore]
│   │   │   ├── src/
│   │   │   │   ├── main/
│   │   │   │   │   ├── assets/
│   │   │   │   │   │   ├── audio/          (que_te_vale.mpeg, sacamos_cinco.mpeg)
│   │   │   │   │   │   ├── public/         [generada por Capacitor; excluida en .gitignore]
│   │   │   │   │   │   └── vosk-model-es/  (14 archivos del modelo offline español, 57.49 MB total)
│   │   │   │   │   ├── java/edu/udes/uav/gcs/
│   │   │   │   │   │   ├── MainActivity.java
│   │   │   │   │   │   └── VoskVoicePlugin.java
│   │   │   │   │   ├── res/
│   │   │   │   │   └── AndroidManifest.xml
│   │   │   │   ├── oficial/res/values/strings.xml
│   │   │   │   └── testeo/res/values/strings.xml
│   │   │   ├── build.gradle
│   │   │   └── proguard-rules.pro
│   │   ├── capacitor-cordova-android-plugins/
│   │   ├── gradle/wrapper/
│   │   ├── build.gradle
│   │   ├── gradlew / gradlew.bat
│   │   ├── local.properties                [excluida en .gitignore]
│   │   └── settings.gradle
│   ├── node_modules/                       [excluida en .gitignore]
│   ├── www/index.html
│   ├── www-oficial/index.html
│   ├── www-testeo/index.html
│   ├── capacitor.config.json
│   ├── package.json
│   └── package-lock.json
├── docs/
│   ├── bitacora/
│   │   ├── 01-arquitectura-y-simulador/
│   │   │   ├── informes/                   (informe-1.0.md .. informe-1.6.md)
│   │   │   └── pedidos/                    (pedido-1.0.md .. pedido-1.6.md)
│   │   ├── 02-diseno-chasis-abs/
│   │   │   ├── informes/                   (informe-2.0.md, informe-2.1.md)
│   │   │   └── pedidos/                    (pedido-2.0.md, pedido-2.1.md)
│   │   ├── 03-visor-3d-y-documentacion/
│   │   │   ├── informes/                   (informe-3.0.md, informe-3.1.md)
│   │   │   └── pedidos/                    (pedido-3.0.md, pedido-3.1.md)
│   │   ├── 04-voz-offline-y-paquetes-finales/
│   │   │   ├── informes/                   (informe-4.1.md, informe-4.2.md)
│   │   │   └── pedidos/                    (pedido-4.1.md, pedido-4.2.md)
│   │   └── 05-preparacion-repositorio/
│   │       ├── informes/                   (informe-5.0-repositorio.md)
│   │       └── pedidos/                    (pedido-5.0-repositorio.md)
│   └── media/                              (7 fotografías seleccionadas del prototipo)
│       ├── esquema-etapa-mosfet.jpg
│       ├── placa-potencia-mosfets.jpg
│       ├── prototipo-detalle-mt3608.jpg
│       ├── prototipo-perfil-doble-nivel.jpg
│       ├── prototipo-perfil-esp32.jpg
│       ├── prototipo-vista-general.jpg
│       └── prototipo-vista-superior.jpg
├── firmware/
│   ├── dron_oficial_mpu6050/
│   │   └── dron_oficial_mpu6050.ino
│   └── dron_testeo_motores/
│       └── dron_testeo_motores.ino
├── hardware/
│   ├── chasis-stl/
│   │   ├── 01_placa-inferior.stl
│   │   ├── 02_piso-superior-abs.stl
│   │   ├── 03_brazo-motor-a.stl
│   │   ├── 04_brazo-motor-b.stl
│   │   ├── 05_columna-malla-36mm.stl
│   │   └── plano-distribucion-piso-superior.svg
│   └── datasheets/
│       ├── ESP32-WROOM-32D.pdf
│       ├── IRFZ44N.pdf
│       ├── MPU-6050.pdf
│       └── MT3608.pdf
├── releases/                               [excluida en .gitignore]
│   ├── dron-oficial.apk
│   └── dron-testeo.apk
├── scripts/
│   └── compilar-apks.ps1
├── simulador-pc/
│   ├── index.html
│   └── modo-wifi.js
└── visor-3d/
    ├── css/styles.css
    ├── js/                                 (9 módulos ES6)
    ├── vendor/three/                       (three.module.js, OrbitControls.js, STLLoader.js)
    ├── abrir-visor-3d.bat
    ├── index.html
    └── servir.js
```

---

## 3. Tabla de Archivos y Carpetas Movidos / Renombrados

| Origen Anterior | Destino Final | Notas |
| :--- | :--- | :--- |
| `app-control-uav\` | `app-android\` | Renombrado de carpeta raíz conservando `android/`, `www-oficial/`, `www-testeo/`, `package.json`, `capacitor.config.json`. |
| `presentacion-3d\` | `visor-3d\` | Renombrado de carpeta del visor Three.js. |
| `presentacion-3d\ABRIR-ANIMACION-3D.bat` | `visor-3d\abrir-visor-3d.bat` | Normalización a `kebab-case`. |
| `modo-wifi.js` | `simulador-pc\modo-wifi.js` | Reubicado dentro de `simulador-pc\` con rutas actualizadas hacia `../app-android/` y `../releases/`. |
| `Tramos\4to\esp32_oficial\dron_oficial_mpu6050\dron_oficial_mpu6050.ino` | `firmware\dron_oficial_mpu6050\dron_oficial_mpu6050.ino` | Conserva carpeta padre idéntica al nombre `.ino` (regla Arduino IDE). |
| `Tramos\4to\esp32_test\prueba_motores_voz.ino` | `firmware\dron_testeo_motores\dron_testeo_motores.ino` | Renombrado y encapsulado en carpeta `dron_testeo_motores\` (regla Arduino IDE). |
| `Tramos\3ro\STL\01_placa-inferior_LIGERA_escotilla.stl` | `hardware\chasis-stl\01_placa-inferior.stl` | Pieza definitiva #1. |
| `Tramos\3ro\STL\04_piso-superior_deck_V6_ABS.stl` | `hardware\chasis-stl\02_piso-superior-abs.stl` | Pieza definitiva #2 (V6 con compensación térmica ABS `×1.006`). |
| `Tramos\3ro\STL\arm-a_pata-motor.stl` | `hardware\chasis-stl\03_brazo-motor-a.stl` | Pieza definitiva #3. |
| `Tramos\3ro\STL\arm-b_pata-motor.stl` | `hardware\chasis-stl\04_brazo-motor-b.stl` | Pieza definitiva #4. |
| `Tramos\3ro\STL\columna_V_malla_H36m.stl` | `hardware\chasis-stl\05_columna-malla-36mm.stl` | Pieza definitiva #5. |
| `Impresiones\plano-verificacion-piso-superior-V6-ABS.svg` | `hardware\chasis-stl\plano-distribucion-piso-superior.svg` | Plano técnico 1:1 de la versión ABS definitiva. |
| `Tramos\3ro\DATASHEETs\ESP32-WROOM-32D.PDF` | `hardware\datasheets\ESP32-WROOM-32D.pdf` | Extensión normalizada a `.pdf` minúscula. |
| `Tramos\3ro\DATASHEETs\IRFZ44N.PDF` | `hardware\datasheets\IRFZ44N.pdf` | Extensión normalizada a `.pdf` minúscula. |
| `Tramos\3ro\DATASHEETs\MT3608.PDF` | `hardware\datasheets\MT3608.pdf` | Extensión normalizada a `.pdf` minúscula. |
| `Tramos\3ro\DATASHEETs\MPU-6000.PDF` | `hardware\datasheets\MPU-6050.pdf` | Renombrado al código del módulo utilizado y extensión `.pdf`. |
| `compilar-dos-apks.ps1` | `scripts\compilar-apks.ps1` | Movido a `scripts/` y actualizado hacia `app-android\` y `releases\`. |
| `Tramos\4to\APKs\dron-oficial.apk` | `releases\dron-oficial.apk` | Binario local en carpeta ignorada por Git. |
| `Tramos\4to\APKs\dron-testeo.apk` | `releases\dron-testeo.apk` | Binario local en carpeta ignorada por Git. |
| `Tramos\3ro\fotos y videos reales\WhatsApp Image 2026-11-20 at 3.10.17 AM.jpeg` | `docs\media\prototipo-vista-superior.jpg` | Selección visual #1 (vista cenital completa). |
| `Tramos\3ro\fotos y videos reales\WhatsApp Image 2026-11-20 at 3.10.01 AM (2).jpeg` | `docs\media\prototipo-vista-general.jpg` | Selección visual #2 (perspectiva general). |
| `Tramos\3ro\fotos y videos reales\WhatsApp Image 2026-11-20 at 3.10.18 AM (6).jpeg` | `docs\media\prototipo-perfil-esp32.jpg` | Selección visual #3 (perfil lado ESP32). |
| `Tramos\3ro\fotos y videos reales\WhatsApp Image 2026-11-20 at 3.10.17 AM (7).jpeg` | `docs\media\prototipo-perfil-doble-nivel.jpg` | Selección visual #4 (perfil doble nivel y columnas). |
| `Tramos\3ro\fotos y videos reales\WhatsApp Image 2026-11-20 at 3.10.19 AM (5).jpeg` | `docs\media\prototipo-detalle-mt3608.jpg` | Selección visual #5 (elevador MT3608 y cableado). |
| `Tramos\3ro\fotos y videos reales\MOSFESTs\WhatsApp Image 2026-11-20 at 8.44.47 AM.jpeg` | `docs\media\placa-potencia-mosfets.jpg` | Selección visual #6 (baquelita con 4× IRFZ44N y diodos). |
| `Tramos\3ro\fotos y videos reales\MOSFESTs\WhatsApp Image 2026-11-19 at 9.13.44 AM.jpeg` | `docs\media\esquema-etapa-mosfet.jpg` | Selección visual #7 (diagrama esquemático de etapa MOSFET). |
| `Tramos\1ro\Pedido\*.md` e `Informes\*.md` (14 archivos) | `docs\bitacora\01-arquitectura-y-simulador\pedidos\` e `informes\` | Bitácora Tramo 1 normalizada. |
| `Tramos\2do\pedido\*.md` e `informes\*.md` (4 archivos) | `docs\bitacora\02-diseno-chasis-abs\pedidos\` e `informes\` | Bitácora Tramo 2 normalizada. |
| `Tramos\3ro\Pedido\*.md` e `Informes\*.md` (4 archivos) | `docs\bitacora\03-visor-3d-y-documentacion\pedidos\` e `informes\` | Bitácora Tramo 3 normalizada. |
| `Tramos\4to\pedido\*.md` e `informe\*.md` (4 archivos) | `docs\bitacora\04-voz-offline-y-paquetes-finales\pedidos\` e `informes\` | Bitácora Tramo 4 normalizada. |
| `Tramos\5to\pedidos\pedido-5.0-repositorio.md` | `docs\bitacora\05-preparacion-repositorio\pedidos\pedido-5.0-repositorio.md` | Pedido actual migrado. |

---

## 4. Archivos y Carpetas Eliminados (Limpieza Segura)

Se verificaron previamente los hashes SHA-256 de todos los duplicados antes de eliminar:

1. **Carpeta `firmware-esp32\` completa (firmwares obsoletos v1.0–1.5):**
   - `firmware-esp32\drone_controller\drone_controller.ino`
   - `firmware-esp32\drone_controller_esp32\drone_controller_esp32.ino`
   - `firmware-esp32\drone_controller 2.ino` (copia duplicada vieja)
   - *Justificación:* Reemplazados por `firmware\dron_oficial_mpu6050\dron_oficial_mpu6050.ino` y `firmware\dron_testeo_motores\dron_testeo_motores.ino`.
2. **Duplicados binarios internos de `visor-3d\assets\`:**
   - `visor-3d\assets\stl\*.stl` (5 archivos) y `visor-3d\assets\datasheets\*.pdf` (4 archivos).
   - *Justificación:* Hashes SHA-256 verificados 100 % idénticos a los archivos ya centralizados en `hardware\chasis-stl\` y `hardware\datasheets\`. Se modificó `visor-3d\servir.js` para servir `/hardware/*` directamente desde `../hardware/`, eliminando duplicación en Git sin perder compatibilidad HTTP ni con Live Server.
3. **Carpeta `Impresiones\` completa (CAD obsoletos/no impresos y scripts temporales):**
   - Copias duplicadas de los 5 `.stl` definitivos (`01_placa-inferior_LIGERA_escotilla.stl`, `04_piso-superior_deck_V6_ABS.stl`, `arm-a_pata-motor.stl`, `arm-b_pata-motor.stl`, `columna_V_malla_H36m.stl`).
   - Versiones CAD obsoletas o no utilizadas: `03_puerta-escotilla.stl`, `04_piso-superior_deck_V6.stl` (sin compensación ABS), `04_piso-superior_deck_V7_ABS.stl`, `plano-verificacion-piso-superior-V7.svg`.
   - Scripts generadores Python temporales: `generar_piso_superior_v6_abs.py`, `generar_piso_superior_v7.py`.
4. **Script obsoleto de APK único:** `compilar-apk.ps1` (reemplazado desde el Tramo 4.2 por `scripts\compilar-apks.ps1`).
5. **Carpeta duplicada `informes\` en la raíz:** contenía únicamente `informes\informe-1.0.md`, copia SHA-256 idéntica a `docs\bitacora\01-arquitectura-y-simulador\informes\informe-1.0.md`.
6. **HTML legado de `app-android\index.html`:** apuntaba a `./www/app.js`, `./www/styles.css` y `./www/manifest.json` inexistentes; los paquetes reales usan `www-oficial\index.html` y `www-testeo\index.html`.
7. **Restos de `Tramos\` tras la migración:**
   - `Tramos\4to\Canciones\` (`WhatsApp Audio 2026-11-20 at 7.03.11 AM.mpeg` y `7.03.55 AM.mpeg`): SHA-256 idénticos a `app-android\android\app\src\main\assets\audio\sacamos_cinco.mpeg` y `que_te_vale.mpeg`.
   - `2` videos `.mp4` crudos pesados (`12.34 MB` y `33.73 MB`).
   - `32` fotografías repetidas/descartadas de WhatsApp (conservando las `7` mejores en `docs\media\`).
   - Carpetas vacías residuales (`Tramos\3ro\Imagenes\`, `Tramos\3ro\Video\`, `Tramos\`, etc.).
8. **Preservación de `.build-tools\`:** Confirmado en disco que `.build-tools\jdk-17` y `.build-tools\android-sdk` permanecen intactos localmente y excluidos del control de versiones en `.gitignore`.

---

## 5. Actualizaciones Técnicas de Rutas Internas

1. **Visor 3D sin duplicados (`visor-3d\`):**
   - `visor-3d\js\config.js`: `STL_BASE_PATH` actualizado a `'../hardware/chasis-stl/'` y mapa `STL_FILES` actualizado a `01_placa-inferior.stl`, `02_piso-superior-abs.stl`, `03_brazo-motor-a.stl`, `04_brazo-motor-b.stl` y `05_columna-malla-36mm.stl`.
   - `visor-3d\index.html`: enlaces locales de referencias actualizados a `../hardware/datasheets/ESP32-WROOM-32D.pdf`, `IRFZ44N.pdf`, `MT3608.pdf` y `MPU-6050.pdf`.
   - `visor-3d\servir.js`: añadido montaje seguro de `/hardware/` hacia `path.resolve(__dirname, '..', 'hardware')` manteniendo validación anti *path-traversal* (`403`). Con ello, tanto `abrir-visor-3d.bat` (`http://127.0.0.1:3030`) como un servidor estático desde la raíz resuelven exactamente los mismos 5 STL y 4 PDFs sin duplicar archivos binarios.
2. **Script de Compilación (`scripts\compilar-apks.ps1`):**
   - Ajustado `$ProjectRoot = Split-Path -Parent $ScriptDir` al vivir dentro de `scripts\`.
   - Actualizado `$AppDir` a `app-android\` y `$OutApksDir` a `releases\`, agregando además respaldo automático a `$env:ANDROID_HOME` / `$env:ANDROID_SDK_ROOT` si no existe `.build-tools\android-sdk` en otro equipo.
3. **Emulador Wi-Fi (`simulador-pc\modo-wifi.js`):**
   - Actualizado `ROOT_DIR = path.resolve(__dirname, "..")`, `APP_WWW_DIR = path.join(ROOT_DIR, "app-android", "www")`, `SIM_DIR = __dirname`, y resolución de APK priorizando `releases/dron-oficial.apk` con respaldo a `app-android/www/uav-control.apk` y salida Gradle `oficial/debug/app-oficial-debug.apk`.

---

## 6. Resultados de Auditoría y Verificación Integral

### 6.1 Regla Arduino IDE
- `firmware\dron_oficial_mpu6050\dron_oficial_mpu6050.ino`: carpeta `dron_oficial_mpu6050` == base `dron_oficial_mpu6050` (**OK**).
- `firmware\dron_testeo_motores\dron_testeo_motores.ino`: carpeta `dron_testeo_motores` == base `dron_testeo_motores` (**OK**).

### 6.2 Prueba HTTP en Vivo del Visor 3D (`visor-3d\servir.js`)
Verificación de sintaxis con `node --check` (**OK** en `servir.js` y `modo-wifi.js`) y peticiones HTTP reales contra `http://127.0.0.1:3030`:

| Recurso Verificado | Código HTTP | Tamaño Servido |
| :--- | :---: | ---: |
| `/` (`index.html`) | `200` | `7,943 bytes` |
| `/js/config.js` | `200` | `6,757 bytes` |
| `/hardware/chasis-stl/01_placa-inferior.stl` | `200` | `824,884 bytes` |
| `/hardware/chasis-stl/02_piso-superior-abs.stl` | `200` | `667,284 bytes` |
| `/hardware/chasis-stl/03_brazo-motor-a.stl` | `200` | `110,684 bytes` |
| `/hardware/chasis-stl/04_brazo-motor-b.stl` | `200` | `111,384 bytes` |
| `/hardware/chasis-stl/05_columna-malla-36mm.stl` | `200` | `96,584 bytes` |
| `/hardware/datasheets/ESP32-WROOM-32D.pdf` | `200` | `657,160 bytes` |
| `/hardware/datasheets/IRFZ44N.pdf` | `200` | `74,288 bytes` |
| `/hardware/datasheets/MT3608.pdf` | `200` | `617,883 bytes` |
| `/hardware/datasheets/MPU-6050.pdf` | `200` | `932,754 bytes` |

### 6.3 Script de Compilación, APKs y Enlaces de `README.md`
- **Sintaxis PowerShell de `scripts\compilar-apks.ps1`:** `0` errores detectados por `System.Management.Automation.Language.Parser`; `0` referencias obsoletas (`Tramos\4to`, `app-control-uav`); todas las rutas resueltas (`.build-tools\jdk-17`, `.build-tools\android-sdk`, `app-android\`, `releases\`) existen en disco.
- **Verificación `aapt2` sobre binarios en `releases\`:**
  - `releases\dron-oficial.apk` (`56.86 MB`): `package: name='com.udes.dronoficial'` · `application-label:'Dron Oficial'`.
  - `releases\dron-testeo.apk` (`56.86 MB`): `package: name='com.udes.drontesteo'` · `application-label:'Dron Testeo'`.
- **Enlaces locales en `README.md`:** `29/29` enlaces e imágenes relativos verificados existentes en disco (`0` enlaces rotos).

### 6.4 Auditoría de Tamaños para Límites de GitHub (`> 40 MB`)
Excluyendo las rutas cubiertas por `.gitignore` (`.build-tools/`, `releases/`, `node_modules/`, `.gradle/`, `build/`, `local.properties`, `app/src/main/assets/public/`, `*.apk`, `*.mp4`, etc.):

- **Total de archivos trackeables por Git (incluyendo este informe):** `152` archivos.
- **Archivos trackeables mayores a `40 MB`:** **`0`** (ningún archivo activa el aviso de `50 MB` ni el bloqueo de `100 MB` de GitHub; no requiere Git LFS).
- **Top 10 archivos trackeables más pesados:**

| Peso | Archivo Trackeable |
| ---: | :--- |
| `20.807 MB` | `app-android\android\app\src\main\assets\vosk-model-es\graph\Gr.fst` |
| `15.352 MB` | `app-android\android\app\src\main\assets\vosk-model-es\am\final.mdl` |
| `11.660 MB` | `app-android\android\app\src\main\assets\vosk-model-es\graph\HCLr.fst` |
| `9.467 MB` | `app-android\android\app\src\main\assets\vosk-model-es\ivector\final.ie` |
| `1.214 MB` | `visor-3d\vendor\three\three.module.js` |
| `0.890 MB` | `hardware\datasheets\MPU-6050.pdf` |
| `0.787 MB` | `hardware\chasis-stl\01_placa-inferior.stl` |
| `0.636 MB` | `hardware\chasis-stl\02_piso-superior-abs.stl` |
| `0.627 MB` | `hardware\datasheets\ESP32-WROOM-32D.pdf` |
| `0.589 MB` | `hardware\datasheets\MT3608.pdf` |

> **Nota sobre Vosk (`vosk-model-es/`):** El modelo completo pesa **`57.49 MB`** en conjunto repartidos en `14` archivos individuales, siendo `Gr.fst` (`20.81 MB`) el archivo individual más grande del repositorio trackeado. Por lo tanto, el repositorio puede subirse a GitHub directamente por Git estándar sin bloqueos por tamaño individual de archivo.
