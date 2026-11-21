# PEDIDO 3.1 (TRAMO 3): Ficha Limpia, Referencias a Datasheets, Topología Real de Baquelita MOSFETs y Despiece Individual con Circuitos 3D

## Objetivo y Alcance Estricto
Actualizar la aplicación web 3D existente en `C:\Dev\Control Dron\presentacion-3d\` manteniendo intactos el fondo blanco puro (`#FFFFFF`), el ensamblaje exacto de los 5 `.stl`, la iluminación de estudio y la fluidez de cámara.

**PROHIBIDO MODIFICAR** ningún `.stl`, foto, video, firmware ESP32, simulador ni APK de los Tramos 1 y 2. Trabajar exclusivamente en `C:\Dev\Control Dron\presentacion-3d\` y reportar en `C:\Dev\Control Dron\Tramos\3ro\Informes\informe-3.1.md`.

---

## 1. Encabezado Superior Izquierdo Limpio (Sin Etiquetas Literales)
- **Eliminar por completo** la píldora actual `● Prototipo Cuadricóptero V6 — Visor 3D` de la esquina superior izquierda.
- En su lugar, colocar una tarjeta tipográfica minimalista y limpia (armonizada con el fondo blanco puro, y que también se oculte al activar `Modo Limpio [H]`) mostrando los datos del equipo **SIN escribir ninguna etiqueta literal** (prohibido poner "Nombre:", "Código:", "Carrera:", "Materia:" o "Profesor:"). La jerarquía visual (pesos, tamaños, espaciado y grises sobrios) debe dejar claro a simple vista cada dato:
  - **Fredy Omar Avila Triana** · `01251151005`
  - **Andres Felipe Castilla Caselles** · `01251151011`
  - `Ingeniería en Ciencias de la Computación e Inteligencia Artificial`
  - `Fundamentos de Electrónica y Computación`
  - `Daniel Romero`

---

## 2. Botón Desplegable "Referencias" (Datasheets Oficiales + Respaldo Local)
- Ubicar un botón/panel compacto **`Referencias`** justo debajo del panel de controles superior derecho (debajo de `Modo Limpio [H]`).
- Al hacer clic en **`Referencias`**, desplegar una lista limpia con los 4 componentes. Al hacer clic en cada nombre debe abrir su enlace oficial de AllDatasheet en una pestaña nueva (`target="_blank" rel="noopener noreferrer"`):
  1. **ESP32-WROOM-32D** → `https://www.alldatasheet.com/datasheet-pdf/pdf/1148027/ESPRESSIF/ESP32-WROOM-32D.html`
  2. **IRFZ44N (MOSFET)** → `https://www.alldatasheet.com/datasheet-pdf/pdf/17807/PHILIPS/IRFZ44N.html`
  3. **MT3608 (Elevador)** → `https://www.alldatasheet.com/datasheet-pdf/pdf/1131968/ETC1/MT3608.html`
  4. **MPU-6050 (Giroscopio)** → `https://www.alldatasheet.com/datasheet-pdf/pdf/1132807/TDK/MPU-6050.html`
- **Respaldo Offline:** Copiar los 4 archivos PDF existentes en `C:\Dev\Control Dron\Tramos\3ro\DATASHEETS\` (`ESP32-WROOM-32D.pdf`, `IRFZ44N.pdf`, `MT3608.pdf`, `MPU-6000.pdf`) hacia `C:\Dev\Control Dron\presentacion-3d\assets\datasheets\` y colocar junto a cada enlace un botón pequeño `PDF` que abra el archivo local en otra pestaña por si no hay internet en el salón.

---

## 3. Corrección Fiel de la Placa de Potencia (Baquelita de MOSFETs)
Inspeccionar las fotos y video de referencia en `C:\Dev\Control Dron\Tramos\3ro\fotos y videos reales\MOSFESTs\` y corregir el modelado actual de la baquelita perforada para reflejar exactamente la topología real soldada:
- **Diseño físico de la baquelita:** Cara superior ocre con filas tipo protoboard soldable y cara inferior verde con pistas de cobre y puntos de estaño.
- **Riel largo externo de positivo (`B+`):** Un riel longitudinal continuo en el borde externo donde llegan el cable rojo positivo de la batería (`B+`), el positivo del elevador (`VIN+`) y los 4 cables blancos positivos de los motores (`M+`).
- **4 puentes rojos en arco ("aritos rojos"):** Conectan desde ese riel longitudinal de `B+` hacia las 4 tiras cortas de 4 puntos donde va soldado el **cátodo (lado CON franja plateada)** de cada uno de los 4 diodos flyback.
- **4 Diodos Flyback cruzando la separación central:** Cada diodo puentea desde la tira positiva hacia la tira del lado de los MOSFETs; su **ánodo (lado SIN franja)** se une directamente a la **Pata 2 (Centro — Drain)** de su IRFZ44N junto con el cable negativo del motor (`M−`).
- **Doble riel central longitudinal de negativo común (`B− / GND`):** En el centro de la placa corren dos filas largas paralelas; en el bus negativo común se unen con puentes negros cortos las **4 Patas 3 (Derecha — Source)** de los IRFZ44N, el cable negro negativo de la batería (`B−`) y el cable gris negativo del elevador (`VIN−`).
- **4 Gates (Pata 1 — Izquierda):** Conectados a los 4 cables blancos de señal PWM que van hacia los pines del ESP32 (`GPIO 25, 26, 27, 14`).
- *(Detalle fiel adicional)*: Cambiar el envoltorio de la batería 18650 a rojo metálico/brillante como la celda real de las fotos.

---

## 4. Despiece Individual por Componente + Circuitos 3D Internos + Ocultar y Opacidad
Transformar el comportamiento de la inspección cuando el usuario selecciona cualquiera de las 4 vistas de componente (`MOSFETs`, `MT3608`, `MPU-6050`, `ESP32`):

### A. Comportamiento General vs. Modo Componente
- En las vistas **`General`**, **`Superior`** y **`Perfil`**: el slider `Despiece` mantiene el despiece vertical global del dron completo (Piso 2, columnas, Piso 1).
- Al hacer clic en **`MOSFETs`**, **`MT3608`**, **`MPU-6050`** o **`ESP32`**:
  1. El panel derecho activa automáticamente el bloque de **Inspección del Componente Activo** con:
     - **Slider `Separar [Componente]` (`0%` a `100%`)** (o el mismo slider `Despiece` cambia su etiqueta y actúa **ÚNICAMENTE** sobre ese componente): **solo ese módulo se levanta verticalmente** respecto al chasis sin mover el resto del dron, y la cámara retrocede ligeramente de forma suave para encuadrar cómodamente tanto el módulo elevado como el circuito 3D que emerge debajo/adentro, manteniendo rotación libre 360° con el mouse.
     - **Botón `Ocultar [Componente]`** (Toggle `Visible / Oculto`) para esconder por completo la pieza física del componente y dejar el circuito 3D totalmente despejado.
     - **Slider `Opacidad` (`0%` a `100%`)** para volver semitransparente la pieza física (efecto rayos X) sin perder la referencia espacial de dónde está cada pin.
  2. Al volver a `General`, `Superior` o `Perfil` (o cambiar a otro componente), restaurar suavemente el componente previo a `0%` de separación, visible y `100%` de opacidad.

### B. Circuitos y Conexiones 3D Específicos por Componente (Respaldados por los 4 Datasheets en `Tramos\3ro\DATASHEETS\`)

1. **Vista `MOSFETs` — Circuito 3D de Conmutación y Protección Flyback:**
   - Al elevar la baquelita, desplegar en el plano/volumen revelado entre el chasis y la placa un **circuito esquemático 3D limpio, nítido y profesional** fiel al dibujo a mano ubicado en `C:\Dev\Control Dron\Tramos\3ro\fotos y videos reales\MOSFESTs\` (sin los círculos hechos a lápiz) y a la topología real de 4 canales:
     - Incluir un selector rápido **`1 Canal (Detalle)` / `4 Canales (Placa)`** dentro del panel cuando `MOSFETs` está activo:
       - **1 Canal (Detalle):** Muestra un bloque esquemático 3D súper claro de un solo IRFZ44N (Pata 1 `Gate ← Pin ESP32`, Pata 2 `Drain → M− + Ánodo Diodo`, Pata 3 `Source → B− / GND`), línea roja `B+ (3.7V) → M+ + Cátodo (franja) Diodo`, símbolo 3D del diodo flyback con indicador direccional, y etiquetas 3D nítidas (`Gate`, `Drain`, `Source`, `B+`, `B−`, `M+`, `M−`, `Diodo Flyback`).
       - **4 Canales (Placa):** Muestra los 4 circuitos repetidos en paralelo sobre los rieles reales de la baquelita (riel externo `B+`, aritos rojos, 4 diodos, doble riel central `B−`, y salidas a `GPIO 25 / 26 / 27 / 14`).

2. **Vista `MT3608` — Circuito 3D del Elevador Boost DC-DC (Según `MT3608.pdf`):**
   - Al elevar el módulo MT3608, revelar en 3D su esquema de conexiones internas y externas basado en la aplicación típica de `C:\Dev\Control Dron\Tramos\3ro\DATASHEETS\MT3608.pdf`:
     - Entradas `VIN+ (3.7V Batería)` y `VIN− (B−)` → Inductor `L1 (22 µH)` conectado al pin `SW` del integrado `MT3608 (SOT23-6: SW, GND, FB, EN, IN)` → Diodo Schottky rectificador hacia `VOUT+ (5.0V → ESP32 5V/VIN)` → Divisor resistivo / Potenciómetro de calibración conectado a `FB (0.6V)` y capacitores de entrada/salida hacia `VOUT− (GND ESP32)`.
     - Etiquetas 3D limpias y código de color coherente (rojo `3.7V`, naranja `5.0V`, negro/gris `GND`).

3. **Vista `MPU-6050` — Esquema 3D de Conexiones I2C (Según `MPU-6000.pdf`):**
   - Al elevar el módulo MPU-6050, revelar en 3D su arquitectura y mapa de pines según `C:\Dev\Control Dron\Tramos\3ro\DATASHEETS\MPU-6000.pdf`:
     - Resaltar con pistas 3D luminosas los **4 pines conectados**: `VCC → 3V3`, `GND → GND`, `SCL → GPIO 22`, `SDA → GPIO 21` (dirección I2C `0x68`), junto a la representación 3D minimalista del bloque interno (`MEMS 6-Ejes: Gyro + Accel → ADC 16-bit → I2C`).
     - Indicar discretamente en gris los **4 pines sin conectar**: `XDA`, `XCL`, `AD0`, `INT` (`Libres`).

4. **Vista `ESP32` — Elevación Limpia y Mapa 3D de Pines Conectados (SIN Circuito Interno Gigante):**
   - **NO** intentar dibujar un esquemático interno del ESP32.
   - Al elevar el módulo ESP32-WROOM-32D, levantarlo limpiamente desde su alojamiento para exponer con total nitidez **únicamente los pines exactos que usa el dron** con líneas guía 3D verticales/peinadas y etiquetas flotantes claras (verificadas con `ESP32-WROOM-32D.pdf`):
     - `5V / VIN` ← `VOUT+ (5.0V)` del MT3608 (naranja)
     - `GND` ← Tierra común `VOUT− / B− / Source` (gris/negro)
     - `3V3` → `VCC` del MPU-6050 (rojo)
     - `GPIO 21 (SDA)` ↔ Datos I2C MPU-6050 (azul)
     - `GPIO 22 (SCL)` ↔ Reloj I2C MPU-6050 (verde)
     - `GPIO 25` → Gate `M1` (Del. Izq CW)
     - `GPIO 26` → Gate `M2` (Del. Der CCW)
     - `GPIO 27` → Gate `M3` (Tras. Izq CCW)
     - `GPIO 14` → Gate `M4` (Tras. Der CW)
   - Incluir igualmente el botón `Ocultar ESP32` y slider `Opacidad` para inspeccionar sin estorbos las conexiones inferiores.

---

## 5. Verificación y Reporte (`C:\Dev\Control Dron\Tramos\3ro\Informes\informe-3.1.md`)
Documentar brevemente:
1. Los cambios realizados en la UI (ficha superior izquierda sin etiquetas, menú `Referencias` con links + PDFs locales copiados).
2. La corrección física de la baquelita de MOSFETs frente a las fotos en `MOSFESTs\`.
3. Cómo funciona el despiece individual con controles de ocultar/opacidad y qué elementos 3D muestra cada uno de los 4 módulos (`MOSFETs`, `MT3608`, `MPU-6050`, `ESP32`).