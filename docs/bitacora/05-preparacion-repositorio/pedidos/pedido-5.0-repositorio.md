# PEDIDO 5.0: Reorganización Total, Limpieza, Renombrado de Tramos y Preparación de Repositorio GitHub

## Objetivo General
Reorganizar y limpiar por completo el proyecto ubicado en `C:\Dev\Control Dron\` para dejarlo con una estructura profesional, uniforme y lista para publicar en GitHub como proyecto de Hardware y Software Abierto, **sin romper absolutamente nada de lo que ya funciona** (firmwares ESP32, apps Android Testeo/Oficial, visor 3D offline y simulador PC).

---

## Regla de Oro Antes de Mover o Borrar
1. **Auditar primero todo el árbol real** de `C:\Dev\Control Dron\` antes de ejecutar cambios, para confirmar nombres exactos de carpetas (`www-testeo` vs `variants/testeo`, `Informe` vs `Informes`, etc.).
2. **NO modificar la lógica interna funcional** de los dos firmwares definitivos (Testeo y Oficial), del plugin `VoskVoicePlugin.java`, de las dos interfaces Android ni del visor 3D. Únicamente actualizar **rutas relativas** donde un cambio de nombre de carpeta lo requiera.
3. **Respetar la regla estricta de Arduino IDE:** cada archivo `.ino` debe quedar dentro de una carpeta con exactamente el mismo nombre que el archivo `.ino`.

---

## 1. Reorganización y Renombrado de Carpetas y Archivos

Reestructurar `C:\Dev\Control Dron\` al siguiente árbol limpio en `kebab-case` (sin espacios, tildes ni mayúsculas inconsistentes, salvo nombres propios de archivos estándar como `README.md` y `LICENSE`):

    Control Dron/
    ├── README.md
    ├── LICENSE
    ├── .gitignore
    ├── firmware/
    │   ├── dron_oficial_mpu6050/
    │   │   └── dron_oficial_mpu6050.ino
    │   └── dron_testeo_motores/
    │       └── dron_testeo_motores.ino
    ├── app-android/
    │   └── (contenido de app-control-uav/, manteniendo intacto android/, variants/ o www-testeo/ + www-oficial/, package.json, capacitor.config.*)
    ├── visor-3d/
    │   ├── abrir-visor-3d.bat
    │   └── (contenido de presentacion-3d/, verificando rutas hacia STL y datasheets)
    ├── simulador-pc/
    │   ├── index.html
    │   └── modo-wifi.js (si existe en la raíz, moverlo aquí y ajustar su referencia si aplica)
    ├── hardware/
    │   ├── chasis-stl/
    │   │   ├── 01_placa-inferior.stl               (renombrado desde 01_placa-inferior_LIGERA_escotilla.stl)
    │   │   ├── 02_piso-superior-abs.stl            (renombrado desde 04_piso-superior_deck_V6_ABS.stl)
    │   │   ├── 03_brazo-motor-a.stl                (renombrado desde arm-a_pata-motor.stl)
    │   │   ├── 04_brazo-motor-b.stl                (renombrado desde arm-b_pata-motor.stl)
    │   │   ├── 05_columna-malla-36mm.stl           (renombrado desde columna_V_malla_H36m.stl)
    │   │   └── plano-distribucion-piso-superior.svg (si existe el plano final V6-ABS)
    │   └── datasheets/
    │       ├── ESP32-WROOM-32D.pdf
    │       ├── IRFZ44N.pdf
    │       ├── MT3608.pdf
    │       └── MPU-6050.pdf                        (renombrado desde MPU-6000.pdf si aplica)
    ├── scripts/
    │   └── compilar-apks.ps1                       (movido y actualizado desde compilar-dos-apks.ps1)
    ├── releases/                                   (ignorado en .gitignore; contiene los binarios locales)
    │   ├── dron-oficial.apk
    │   └── dron-testeo.apk
    └── docs/
        ├── media/                                  (selección limpia de máx. 6–8 fotos clave del prototipo físico y baquelita MOSFETs para el README)
        └── bitacora/
            ├── 01-arquitectura-y-simulador/
            │   ├── pedidos/
            │   └── informes/
            ├── 02-diseno-chasis-abs/
            │   ├── pedidos/
            │   └── informes/
            ├── 03-visor-3d-y-documentacion/
            │   ├── pedidos/
            │   └── informes/
            ├── 04-voz-offline-y-paquetes-finales/
            │   ├── pedidos/
            │   └── informes/
            └── 05-preparacion-repositorio/
                ├── pedidos/
                │   └── pedido-5.0-repositorio.md
                └── informes/
                    └── informe-5.0-repositorio.md

### Notas Críticas de Renombrado y Enlaces Internos
1. **Renombrado de Tramos:** Migrar todos los archivos `.md` de `Tramos\1ro`, `2do`, `3ro`, `4to` y `5to` hacia `docs/bitacora/01-arquitectura-y-simulador/`, `02-diseno-chasis-abs/`, `03-visor-3d-y-documentacion/`, `04-voz-offline-y-paquetes-finales/` y `05-preparacion-repositorio/`, normalizando las subcarpetas a `pedidos/` e `informes/` en minúscula. Al terminar la migración, eliminar la carpeta vacía `Tramos/`.
2. **Firmware Testeo:** Mover `prueba_motores_voz.ino` a `firmware/dron_testeo_motores/dron_testeo_motores.ino` (el nombre del archivo y su carpeta padre deben coincidir).
3. **Visor 3D (`visor-3d/`):**
   - Renombrar `ABRIR-ANIMACION-3D.bat` a `abrir-visor-3d.bat` (o mantener compatibilidad).
   - Revisar en todo el código de `visor-3d/` cómo carga los 5 `.stl` y los 4 PDFs de `datasheets/`:
     - Si el visor tiene copias locales en `visor-3d/assets/stl/` o `visor-3d/stl/`, actualizar los nombres o apuntar limpiamente a sus archivos para que **al abrir `abrir-visor-3d.bat` cargue las 5 piezas y los 4 PDFs sin ningún error 404**.
     - Evitar duplicados innecesarios si el servidor local del visor puede servir desde la raíz o mantener en `visor-3d/assets/` únicamente lo que su servidor HTTP necesite, documentando la razón en el informe.
4. **Script de Compilación (`scripts/compilar-apks.ps1`):**
   - Actualizar todas las rutas internas para que apunte a `app-android\`, use `\.build-tools\` (en la raíz del proyecto, ignorada por Git) y deje los dos APK finales en `releases\dron-testeo.apk` y `releases\dron-oficial.apk`.
   - Verificar que el script no tenga rutas hardcodeadas con `Tramos\4to` ni `app-control-uav`.

---

## 2. Eliminación Segura de Archivos Obsoletos, Duplicados y Basura

Inspeccionar y eliminar únicamente archivos que ya no se utilizan (registrando cada archivo eliminado en el informe final):
- Carpeta antigua `firmware-esp32/` (versiones 1.0–1.5 ya reemplazadas por `firmware/dron_oficial_mpu6050/` y `firmware/dron_testeo_motores/`) y cualquier archivo `.ino` duplicado (como copias terminadas en `2`).
- Script obsoleto `compilar-apk.ps1` (reemplazado por `scripts/compilar-apks.ps1`).
- Copias antiguas o fallidas de piezas CAD (`04_piso-superior_deck_V6.stl` sin ABS, `V7`, `V8`, `03_puerta-escotilla.stl` si no se imprimió, scripts Python temporales como `generar_piso_superior_v8.py` y carpetas vacías `Impresiones/` o `Piezas-3D/`).
- Carpeta redundante `Tramos\4to\Canciones\` (si los audios `sacamos_cinco.mpeg` y `que_te_vale.mpeg` ya existen dentro de `app-android/android/app/src/main/assets/audio/`).
- Videos pesados crudos (`.mp4`, `.mov`) y fotos repetidas/borrosas dentro de `Tramos\3ro\fotos y videos reales\` (y la carpeta con typo `MOSFESTs`), conservando únicamente las **5–8 mejores fotografías representativas** (vista superior, perfil, placa de potencia MOSFETs, electrónica montada) renombradas limpiamente en `docs/media/` (ej.: `prototipo-vista-superior.jpg`, `placa-potencia-mosfets.jpg`, `ensamblaje-lateral.jpg`) para incrustarlas en el `README.md`.
- Archivos temporales de sistema o compilación (`Thumbs.db`, `.DS_Store`, logs `*.log`, `*.bak`, carpetas vacías).
- **NO eliminar `.build-tools/` del disco local** (sirve para compilar los APK en tu PC), pero **SÍ excluirla por completo en `.gitignore`**.

---

## 3. Archivos Esenciales a Crear en la Raíz del Repositorio

### A. `.gitignore`
Crear un `.gitignore` completo y estricto para evitar subir archivos pesados o generados a GitHub:
- Herramientas locales de build: `.build-tools/`
- Binarios compilados y releases pesados: `releases/`, `*.apk`, `*.aab`, `*.ap_`
- Node / Capacitor / Web: `node_modules/`, `npm-debug.log*`, `.cache/`, `dist/`
- Android / Gradle: `app-android/android/.gradle/`, `app-android/android/build/`, `app-android/android/app/build/`, `app-android/android/local.properties`, `*.keystore`, `*.jks`, `.idea/`, `*.iml`
- Python / Sistema Operativo / IDE: `__pycache__/`, `*.pyc`, `.DS_Store`, `Thumbs.db`, `desktop.ini`, `.vscode/` (o dejar solo settings compartibles), `*.tmp`, `*.log`
- Videos pesados accidentales: `*.mp4`, `*.mov`, `*.avi`

### B. `LICENSE`
Crear licencia **MIT** (año `2026`, titulares: `Fredy Omar Avila Triana & Andres Felipe Castilla Caselles`).

### C. `README.md` Profesional (Listo para GitHub)
Redactar un `README.md` en español, claro, técnico, visualmente impecable y 100% fiel a los archivos finales reales del repositorio. Debe incluir:
1. **Título, Badges y Descripción:** Nombre del proyecto (ej. `Dron Cuadricóptero ESP32 — Plataforma Educativa Open Hardware & Software`), badges (ESP32, MPU-6050, Android/Capacitor, Vosk Offline, Three.js, License MIT) y una imagen destacada de `docs/media/` si existe.
2. **Características Principales:**
   - Hardware 100% replicable con módulos comerciales y chasis impreso en 3D en ABS (5 piezas `.stl` con compensación térmica).
   - Dos ecosistemas completos e independientes (**Modo Oficial** con estabilización PID + MPU-6050 por WebSocket a 50/100 Hz, y **Modo Testeo** sin giroscopio para banco de pruebas por HTTP).
   - Firmwares nativos en C++/Arduino **sin librerías externas**, compatibles con ESP32 Arduino Core 2.x y 3.x.
   - Control por voz **100% offline** con motor Vosk integrado en el APK (activador `"Dron"`, protección de apagado con umbral de vuelo, modo vuelo, aterrizaje suave y dos coreografías sincronizadas con restauración de potencia).
   - **Visor 3D interactivo offline** en Three.js con los `.stl` reales, despiece individual por módulo, circuitos 3D y acceso a datasheets.
   - **Simulador 2D en PC** para pruebas de telemetría y lógica antes del vuelo físico.
3. **Estructura del Repositorio:** Árbol visual actualizado coincidiendo 100% con los nombres finales reales.
4. **Arquitectura de Hardware y Pinout:**
   - Lista de materiales (BOM): ESP32-WROOM-32D, MPU-6050, MT3608 (5.0 V), 4x IRFZ44N + 4 diodos flyback, batería Li-Ion 18650 (3.7 V), 4 motores DC/coreless y chasis ABS.
   - Tabla exacta de pines: `M1_FL (GPIO 25, CW)`, `M2_FR (GPIO 26, CCW)`, `M3_RL (GPIO 27, CCW)`, `M4_RR (GPIO 14, CW)`, `MPU-6050 (SDA GPIO 21, SCL GPIO 22, 3V3, GND)`, `MT3608 VOUT+ → 5V/VIN`, `PWM 2500 Hz / 10 bits (0–1023)`.
   - Advertencia de seguridad eléctrica: desconectar el pin `5V/VIN` proveniente del MT3608 al conectar el ESP32 por USB al PC.
   - Enlaces directos a los 4 PDFs en `hardware/datasheets/` y a los 5 archivos `.stl` en `hardware/chasis-stl/`.
5. **Guía Rápida de Uso (Paquete Oficial vs. Paquete Testeo):**
   - Tabla comparativa (firmware `.ino`, APK, `applicationId`, red Wi-Fi `UDES_UAV_CONTROL` vs `UDES_MOTORES_TEST`, clave `12345678`, IP `192.168.4.1`, protocolo WebSocket vs HTTP).
   - Pasos para cargar el firmware en Arduino IDE.
   - Instrucciones para descargar los APK desde **GitHub Releases** o recompilarlos localmente con `scripts/compilar-apks.ps1`.
6. **Comandos de Voz Offline (`"Dron"`):**
   - Tabla con los comandos exactos (`Dron, enciende`, `Dron, estás volando`, `Dron, aterriza`, `Dron, apaga` + confirmación `Dron, estoy seguro, apágate`, `Dron, sacamos cinco`, `Dron, qué te vale`) y explicación breve del bloqueo en vuelo y la memoria de potencia durante los bailes.
7. **Visor 3D Interactivo y Simulador PC:** Cómo ejecutar `visor-3d/abrir-visor-3d.bat` y `simulador-pc/index.html`.
8. **Autores y Créditos Académicos:**
   - Fredy Omar Avila Triana (`01251151005`)
   - Andres Felipe Castilla Caselles (`01251151011`)
   - Ingeniería en Ciencias de la Computación e Inteligencia Artificial — Universidad de Santander (UDES)
   - Materia: Fundamentos de Electrónica y Computación · Docente: Daniel Romero
   - Licencia MIT.

---

## 4. Auditoría Final de Integridad y Límites de GitHub
Antes de cerrar, ejecutar mediante terminal (solo lectura/verificación, sin hacer `git push`):
1. **Verificación de tamaños de archivo para GitHub:** Listar cualquier archivo que NO esté ignorado por `.gitignore` y pese más de **40 MB** (especialmente dentro de `app-android/android/app/src/main/assets/vosk-model-es/`), advirtiendo si alguno supera el límite de 50 MB / 100 MB de GitHub para manejarlo con Git LFS o descarga en script si fuera necesario.
2. **Verificación de referencias rotas:** Comprobar que en `visor-3d/`, `scripts/compilar-apks.ps1` y `README.md` todas las rutas locales existan realmente en disco.
3. **Informe Final (`docs/bitacora/05-preparacion-repositorio/informes/informe-5.0-repositorio.md`):**
   - Árbol final real de carpetas.
   - Tabla completa de archivos renombrados/movidos.
   - Lista de archivos eliminados y justificación.
   - Resultado de la auditoría de tamaños (> 40 MB) y verificación de rutas del visor 3D y script de compilación.