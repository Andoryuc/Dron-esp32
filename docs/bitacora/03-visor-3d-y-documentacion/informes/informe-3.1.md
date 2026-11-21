# Informe Técnico — Pedido 3.1 (Tramo 3): Ficha Limpia, Referencias, Baquelita MOSFETs Fiel y Despiece Individual 3D

**Fecha:** 2026-11-20  
**Aplicación actualizada:** `C:\Dev\Control Dron\presentacion-3d\`  
**Estado:** Completado y verificado en navegador (`http://localhost:3030`) con `0` errores de consola y `19/19` peticiones HTTP `200` (incluidos `4/4` respaldos `.pdf` servidos con `Content-Type: application/pdf`).

---

## 1. Cambios en la Interfaz (UI), Ficha Limpia y Menú `Referencias`

1. **Encabezado superior izquierdo minimalista (`index.html`, `css/styles.css`):**
   - Se eliminó por completo la píldora anterior (`Prototipo Cuadricóptero V6 · Visor 3D`).
   - Se reemplazó por `#team-card` (`.team-card.ui-chrome`), tarjeta tipográfica translúcida sobre `#FFFFFF` que también se oculta al activar `Modo Limpio [H]`, presentando los 5 datos **sin ninguna etiqueta literal**:
     - `Fredy Omar Avila Triana` · `01251151005`
     - `Andres Felipe Castilla Caselles` · `01251151011`
     - `Ingeniería en Ciencias de la Computación e Inteligencia Artificial`
     - `Fundamentos de Electrónica y Computación`
     - `Daniel Romero`

2. **Panel desplegable `Referencias` y respaldo offline (`index.html`, `css/styles.css`, `js/panels-slot.js`, `servir.js`):**
   - El panel derecho se agrupó en `.right-rail.ui-chrome`, ubicando `#references-panel` (`Referencias`) inmediatamente debajo de `#control-panel` (`Modo Limpio [H]`).
   - Se copiaron los 4 datasheets desde `C:\Dev\Control Dron\Tramos\3ro\DATASHEETs\` a `C:\Dev\Control Dron\presentacion-3d\assets\datasheets\` (`ESP32-WROOM-32D.pdf`, `IRFZ44N.pdf`, `MT3608.pdf`, `MPU-6000.pdf`), sin modificar los archivos originales, y se agregó `'.pdf': 'application/pdf'` en `MIME_TYPES` dentro de `servir.js`.
   - Cada fila en `#references-list` incluye el enlace externo de AllDatasheet (`target="_blank" rel="noopener noreferrer"`) y un botón `PDF` hacia `./assets/datasheets/...` en nueva pestaña:
     - **ESP32-WROOM-32D** → AllDatasheet (`1148027`) + `./assets/datasheets/ESP32-WROOM-32D.pdf`
     - **IRFZ44N (MOSFET)** → AllDatasheet (`17807`) + `./assets/datasheets/IRFZ44N.pdf`
     - **MT3608 (Elevador)** → AllDatasheet (`1131968`) + `./assets/datasheets/MT3608.pdf`
     - **MPU-6050 (Giroscopio)** → AllDatasheet (`1132807`) + `./assets/datasheets/MPU-6000.pdf`

---

## 2. Corrección Física de la Baquelita de MOSFETs (Frente a `MOSFESTs\`) y Detalles Fieles

Inspeccionando el dibujo a mano (`WhatsApp Image 2026-11-19 at 9.13.44 AM.jpeg`), las fotos de primer plano superior/inferior (`WhatsApp Image 2026-11-20 at 8.44.46 AM.jpeg`, `8.44.47 AM.jpeg`, `8.44.47 AM (1).jpeg`) y el resto de vistas reales:

- **Baquelita doble cara real (`js/materials.js`, `js/electronics.js`):**
  - Cara superior (`createBakeliteTopTexture`) en fenol ocre con matriz de 12 columnas × 25 perforaciones (`X W V U | 8 7 | T S R Q` + riel externo `+X` `P3 / B+`) y serigrafía blanca.
  - Cara inferior (`createBakeliteBottomTexture`) verde con máscara antisoldante (`#1e7a34`), tiras transversales cobrizas de 4 perforaciones, doble riel longitudinal central continuo (`8`/`7`), riel longitudinal externo continuo `B+` y puntos brillantes de estaño en los 4 canales.
- **Topología eléctrica real de 4 canales (`MOSFET_BOARD_LAYOUT` en `js/config.js`, `buildMosfetBoard` en `js/electronics.js`, `js/wiring.js`):**
  - **Riel largo externo `B+` (`X = +14.2`):** recibe el cable rojo `B+` de la batería, el naranja `VIN+` hacia el MT3608 y los 4 positivos de motor (`M+`).
  - **4 puentes rojos en arco ("aritos rojos"):** saltan desde el riel largo `B+` hacia cada tira positiva (`X = +7.5`) donde se suelda el **cátodo (lado CON franja plateada en `+X`)** de cada diodo flyback.
  - **4 Diodos Flyback transversales:** cruzan en eje `X` sobre el doble riel central `8`/`7`; su **ánodo (lado SIN franja en `X = -3.9`)** conecta con la **Pata 2 (Centro — Drain)** del `IRFZ44N` (`X = -11.4`) y la salida negativa del motor (`M−` en `X = -7.6`).
  - **Doble riel central longitudinal `B− / GND` (`X = -1.2 / +1.3`):** recibe el cable negro `B−` de la batería, el gris oscuro `VIN−` del elevador y los **4 puentes negros cortos en arco** provenientes de la **Pata 3 (Source, `mz + 2.54`)** de cada `IRFZ44N`.
  - **4 Gates (Pata 1, `mz - 2.54`):** enlazados con los 4 hilos blancos PWM procedentes de los pines reales del ESP32 (`GPIO 25, 26, 27, 14`).
- **Ajustes fieles adicionales:** envoltorio de la celda 18650 actualizado a rojo metálico brillante (`createBatteryWrapTexture`) y peine real de 38 pines (`19+19`) en el ESP32-WROOM-32D (`ESP32_HEADER` y `createEsp32PcbTexture`).

---

## 3. Despiece Individual por Componente, Ocultar/Opacidad y Circuitos 3D

### A. Mecánica de Inspección Individual (`js/main.js`, `js/camera-presets.js`, `js/electronics.js`)
- En vistas globales (`General`, `Superior`, `Perfil`), el slider `Despiece` controla el despiece vertical completo del prototipo (columnas, deck superior, batería y hélices) con `#component-inspector` oculto.
- Al seleccionar `MOSFETs`, `MT3608`, `MPU-6050` o `ESP32`:
  - El slider cambia su etiqueta a `Separar [Componente]` y eleva verticalmente **únicamente ese módulo** (`COMPONENT_INSPECT_CONFIG[key].liftHeight`), manteniendo el resto del dron estático.
  - Al pulsar `Abrir`/`Cerrar`, `camAnimator.goToView` interpola suavemente hacia `explodedPosition` / `explodedTarget` para retroceder la cámara y encuadrar módulo y circuito; al arrastrar el slider manualmente, `camAnimator.nudgeByDelta` ajusta la cámara incrementalmente sin bloquear ni reiniciar la rotación libre 360° de `OrbitControls`.
  - Cada componente posee materiales clonados e independientes (`isolateComponentMaterials`), permitiendo usar **`Ocultar [Componente]`** y el slider **`Opacidad (0%–100%)`** (con curva rayos-X `visualAlpha`, `needsUpdate` y desactivación de sombras propias por debajo del 88%) sin afectar tornillos ni piezas adyacentes.
  - Al regresar a `General`, `Superior`, `Perfil` o cambiar a otro módulo, el componente previo retorna suavemente a `0%`, `Visible` y `100%` opacidad.

### B. Elementos 3D Revelados por Cada Módulo (`js/component-circuits.js`)
1. **`MOSFETs`** *(con selector rápido `1 Canal (Detalle)` / `4 Canales (Placa)` en `#mosfet-mode-group`)*:
   - **1 Canal (Detalle):** bloque esquemático 3D fiel al dibujo a mano (sin los óvalos a lápiz): `IRFZ44N` con `Gate → Pin ESP32 (PWM)`, `Drain → puente en arco 3D sobre Gate hacia M− + Ánodo del Diodo Flyback`, `Diodo Flyback` 3D con franja plateada de cátodo y cono direccional conectado a `B+ (3.7V) → M+`, y `Source → B− / GND`.
   - **4 Canales (Placa):** proyección 3D paralela 1:1 bajo la baquelita mostrando el riel `B+`, los 4 aritos rojos, los 4 diodos transversales, el doble riel central `B− / GND`, las salidas `M1+..M4+` y los 4 Gates (`M1 · GPIO 25`, `M2 · GPIO 26`, `M3 · GPIO 27`, `M4 · GPIO 14`).
2. **`MT3608`** *(según `MT3608.pdf`)*:
   - Circuito boost 3D sobre el ala `-X` con `VIN+ (3.7V Bat)` y `VIN− (B−)`, capacitor `C1 22µF`, inductor `L1 (22 µH)` conectado al pin `SW` del `MT3608 (SOT23-6: SW · GND · FB · EN · IN)`, diodo `Schottky D1` hacia `VOUT+ (5.0V → ESP32 5V/VIN)`, divisor/potenciómetro `Pot R1/R2 → FB (0.6V)`, `C2 22µF` y retorno común `VOUT− (GND ESP32)`.
3. **`MPU-6050`** *(según `MPU-6000.pdf`)*:
   - Arquitectura interna minimalista (`MEMS 6-Ejes (Gyro+Accel)` → `ADC 16-bit` → `I2C (0x68)`), pistas 3D de color para los **4 pines conectados** (`VCC → 3V3`, `GND → GND`, `SCL → GPIO 22`, `SDA → GPIO 21`) y marcadores grises discretos para los **4 pines libres** (`XDA · XCL · AD0 · INT (Libres)`).
4. **`ESP32`** *(según `ESP32-WROOM-32D.pdf`, **sin** esquemático interno)*:
   - Elevación limpia del módulo con líneas guía 3D verticales y peinadas hacia **únicamente los 9 pines conectados** por el dron: `5V / VIN ← VOUT+ (5.0V) MT3608`, `GND ← VOUT− / B− / Source`, `3V3 → VCC MPU-6050`, `GPIO 21 (SDA) ↔ Datos I2C MPU-6050`, `GPIO 22 (SCL) ↔ Reloj I2C MPU-6050`, `GPIO 25 → Gate M1 (Del. Izq CW)`, `GPIO 26 → Gate M2 (Del. Der CCW)`, `GPIO 27 → Gate M3 (Tras. Izq CCW)` y `GPIO 14 → Gate M4 (Tras. Der CW)`.

---

## 4. Verificación e Integridad de Archivos

- **Sintaxis e HTTP local:** `node --check` exitoso en los 10 archivos `.js`; comprobación HTTP sobre `127.0.0.1:3030` con estado `200` y `Content-Type: application/pdf` en los 4 respaldos locales.
- **Pruebas visuales e interactivas en navegador (`1280×800`):** `0` errores de consola, `19/19` respuestas HTTP `200`, validación completa de `#team-card`, menú `Referencias`, `Modo Limpio [H]`, cara inferior verde de baquelita, los 4 despieces individuales con opacidad rayos-X (~35%) y ocultar, y despiece global final en vista `General`.
- **Restricción de alcance:** No se modificó ningún `.stl` original, foto, video, datasheet fuente en `Tramos\3ro\`, ni archivos de los Tramos 1 y 2.
