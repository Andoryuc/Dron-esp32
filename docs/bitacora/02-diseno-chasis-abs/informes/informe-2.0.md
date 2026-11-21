# INFORME TÉCNICO 2.0 (TRAMO 2): Metrología 3D, Rediseño Paramétrico del Segundo Piso (`04_piso-superior_deck_V7_ABS.stl`), Verificación de Colisiones y Compensación Térmica para Impresión en ABS

## 1. Resumen Ejecutivo de Ingeniería
Se ha ejecutado la auditoría metrológica completa sobre las piezas estructurales 3D existentes en `C:\Dev\Control Dron\Impresiones\` y se ha desarrollado el rediseño paramétrico reproducible del segundo piso del cuadricóptero (**V7 ABS**) manteniendo intactos todos los archivos `.stl` previamente impresos.

Los entregables generados para el Tramo 2 son:
1. **Script paramétrico y auditor metrológico:** `C:\Dev\Control Dron\Impresiones\generar_piso_superior_v7.py`
2. **Modelo 3D listo para laminado en ABS:** `C:\Dev\Control Dron\Impresiones\04_piso-superior_deck_V7_ABS.stl` (`13,956` triángulos, `697,884` bytes, malla cerrada *2-manifold* sin aristas abiertas)
3. **Plano técnico de verificación escala 1:1 (mm):** `C:\Dev\Control Dron\Impresiones\plano-verificacion-piso-superior-V7.svg`
4. **Presente informe de ingeniería:** `C:\Dev\Control Dron\Tramos\2do\Informes\informe-2.0.md`

---

## 2. Metrología 3D de Piezas Ya Impresas (Solo Lectura)

### 2.1. Convención de Ejes Nativos STL
La inspección binaria directa de los 6 archivos `.stl` del proyecto confirma que toda la suite CAD utiliza el sistema de coordenadas con **plano horizontal `(X, Z)`** (`X`: eje transversal lateral; `Z`: eje longitudinal proa/popa) y **eje vertical `Y`** (espesor de placas y altura de columnas).

### 2.2. Inventario Dimensional Verificado en `Impresiones\`

| Archivo STL (Intacto) | Tamaño (bytes) | Triángulos | Rango `X` (mm) | Rango `Y` vertical (mm) | Rango `Z` (mm) | Características Metrológicas Clave |
|---|---:|---:|---|---|---|---|
| `01_placa-inferior_LIGERA_escotilla.stl` | 824,884 | 16,496 | `[-43.47, +43.47]` (`86.95`) | `[-3.50, +8.10]` (placa `0.60..5.10`) | `[-69.00, +45.00]` (`114.00`) | 4 agujeros internos de columna/brazo `Ø 3.30 mm` en `(±24.24, ±24.24) mm`; 4 externos en `(±35.56, ±35.56) mm` |
| `03_puerta-escotilla.stl` | 44,184 | 882 | `[-14.40, +14.40]` (`28.80`) | `[-3.50, +3.00]` (`6.50`) | `[-17.55, +18.50]` (`36.05`) | Tapa inferior de escotilla |
| `arm-a_pata-motor.stl` | 110,684 | 2,212 | `[+19.50, +75.55]` (`56.05`) | `[+5.10, +23.10]` (`18.00`) | `[+15.51, +75.55]` (`60.04`) | Brazo derecho; copa de motor centrada aprox. en `(+63.32, +63.32) mm` (`Y_max = 14.10 mm` en punta) |
| `arm-b_pata-motor.stl` | 111,384 | 2,226 | `[-75.55, -19.50]` (`56.05`) | `[+5.10, +23.10]` (`18.00`) | `[+15.51, +75.55]` (`60.04`) | Brazo izquierdo simétrico respecto a `X = 0` |
| `columna_V_malla_H36m.stl` | 96,584 | 1,930 | `[-8.00, +21.25]` (`29.25`) | `[0.00, +36.00]` (`H = 36.00`) | `[-4.25, +4.25]` (`8.50`) | Base en `(0, 0)` con agujero `Ø 3.50 mm`; zapata superior `12.00 × 8.50 mm` con agujero `Ø 4.20 mm` desplazado `+11.00 mm` hacia el centro (`ΔX = ΔZ = 7.778 mm` a `45°`) |
| `04_piso-superior_deck_V6.stl` | 673,784 | 13,474 | `[-77.00, +77.00]` (`154.00`) | `[0.00, +8.00]` (placa `0.00..3.00`) | `[-89.00, +94.00]` (`183.00`) | 4 anclajes en `(±16.42, ±16.42) mm`; agujero pasante `Ø 3.50 mm` (`Y = 0..1.40`) y cajera `Ø 6.40 mm` (`Y = 1.40..3.00`) |

### 2.3. Extracción Exacta de Coordenadas de Columnas y Hallazgos Críticos en V6
A partir del análisis geométrico de `04_piso-superior_deck_V6.stl` y `columna_V_malla_H36m.stl`:
- **Coordenadas nominales de las 4 columnas en el piso superior:**
  - `C1`: `(-16.420, -16.420) mm`
  - `C2`: `(+16.420, -16.420) mm`
  - `C3`: `(-16.420, +16.420) mm`
  - `C4`: `(+16.420, +16.420) mm`
  - **Distancia entre centros:** `ΔX = 32.840 mm`, `ΔZ = 32.840 mm` (diagonal `46.443 mm`).
  - Nota cinemática: cada columna parte de `(±24.20, ±24.20) mm` sobre la placa inferior y se inclina `11.00 mm` a `45°` hacia el centro (`24.20 - 11.00/√2 = 16.422 mm`), lo que explica exactamente las coordenadas `(±16.42, ±16.42) mm` medidas en `04_piso-superior_deck_V6.stl`.
- **Limitaciones detectadas en `04_piso-superior_deck_V6.stl` corregidas en V7:**
  1. **Giroscopio MPU6050 descentrado:** en V6 se ubicaba en el ala izquierda (`Xc = -55.00 mm`), ya que la batería ocupaba `(0, 0)`. En V7 se reubica el MPU6050 exactamente en `(X = 0.00, Z = 0.00) mm`.
  2. **Colisión de topes batería / MT3608:** en V6 las escuadras de la batería (`X = 33.0..40.0`) se fusionaban con las del elevador MT3608 (`X = 36.6..43.6`).
  3. **Falta de espacio para ESP32 con saliente:** el ala `-Z` en V6 (`55.90 mm` entre topes) no admitía la envolvente de `57.8 × 27.6 mm` con el pedazo extra de `3.0 × 17.5 mm`, y su escuadra en `Z = -25.05 mm` quedaba demasiado próxima a la proyección de la zapata superior de `C1/C2` (`Z = -23.67 mm`).
  4. **Placa de potencia sin rebordes ni pasacables:** en V6 solo contaba con 4 postes (`Ø 6.0 mm`) y sin ranuras dedicadas para bajar los pares `M+` / `M-`.
  5. **Ausencia de compensación térmica ABS:** V6 estaba exportado a escala `1.000` sin factor `1.006` ni holgura `+0.35 mm` en agujeros.

---

## 3. Rediseño Paramétrico V7 (`04_piso-superior_deck_V7_ABS.stl`) y Tabla Comparativa

### 3.1. Tabla Comparativa Técnica: V6 vs. V7 ABS

| Parámetro / Característica | `04_piso-superior_deck_V6.stl` (Línea Base) | `04_piso-superior_deck_V7_ABS.stl` (Rediseño) | Criterio / Mejora |
|---|---|---|---|
| **Envolvente exterior nominal `(X × Z)`** | `154.00 × 183.00 mm` | `197.00 × 197.00 mm` (`±98.50 mm` simétrico) | Simetría cruciforme con alas despejadas |
| **Envolvente exportada STL (escala ABS `1.006`)** | `154.00 × 183.00 mm` (sin compensar) | `198.182 × 198.182 mm` (`[-99.091, +99.091]`) | Compensa `-0.6 %` contracción ABS |
| **Espesor placa base (`Y`)** | `3.00 mm` | `3.00 mm` (`Y = 0.00..3.00 mm`) | Mantiene rigidez estructural |
| **Rebordes guía de componentes** | Escuadras puntuales `3.00 mm` alto + 4 postes `5.00 mm` | Perimetrales continuos `1.20 mm` alto (`Y = 3.00..4.20 mm`), espesor `1.60 mm` | Retención lateral uniforme y ventanas de acceso |
| **Centros nominales columnas `(X, Z)`** | `(±16.420, ±16.420) mm` | `(±16.420, ±16.420) mm` post-contracción (`(±16.519, ±16.519)` en STL) | Encaje 100 % con columnas H36 mm |
| **Distancia entre centros columnas** | `ΔX = 32.840 mm`, `ΔZ = 32.840 mm` | `32.840 mm` nominal (`33.037 mm` en STL ABS) | Error residual teórico `0.000 mm` |
| **Diámetro pasante / cajera columna** | `Ø 3.50 mm` / `Ø 6.40 mm` | `Ø 3.85 mm` / `Ø 6.75 mm` nominal (`3.873 / 6.790 mm` en STL) | `+0.35 mm` tolerancia mecánica + `1.006` ABS |
| **Posición MPU6050 (`20.0 × 15.0 mm`)** | Ala `-X` (`Xc = -55.00 mm`) | **`(X = 0.00, Z = 0.00) mm`** (cavidad `20.50 × 15.50 mm`) | En centro geométrico exacto del cuadricóptero |
| **Posición Batería 3.7 V (`71.0 × 20.0 mm`)** | Centro `(0, 0)` chocando con MT3608 | Ala `-X` (`Xc = -59.75, Zc = 0.00 mm`, cavidad `71.50 × 20.50 mm`) | Eje `Z = 0` simétrico + 2 pares ranuras Velcro `7.0 × 2.8 mm` |
| **Posición MT3608 (`36.0 × 16.0 mm`)** | Ala `+X` (`Xc = +51.50 mm`) solapado | Ala `+X` (`Xc = +43.25, Zc = 0.00 mm`, cavidad `36.50 × 16.50 mm`) | Ventana bilateral `10.0 mm` para tornillo calibración |
| **Posición ESP32 + saliente (`57.8 × 27.6 mm`)** | Ala `-Z` (`55.90 mm`, sin nicho extra) | Ala `-Z` (`Xc = 0.00, Zc = -57.90 mm`, cuerpo `54.8 × 27.6` + nichos `3.0 × 18.0 mm`) | Saliente `3.0 × 17.5 mm` totalmente despejado (`12.68 mm` a agujero / `9.89 mm` a zapata) |
| **Placa Potencia (`70.0 × 33.0 mm`)** | Ala `+Z` sin reborde ni pasacables | Ala `+Z` (`Xc = 0.00, Zc = +61.75 mm`, cavidad `70.50 × 33.50 mm`) | Rebordes `1.2 mm` + 4 postes M2 + 4 ranuras `M+/M-` (`8.0 × 2.8 mm`) |
| **Integridad topológica STL** | `13,474` triángulos | `13,956` triángulos, **0 aristas abiertas**, **0 no-manifold** | Malla *watertight* verificada (`Vol = 41.186 cm³`) |
| **Masa estimada (ABS sólido / 30 % giroide)** | `20.20 g` sólido / `~11.1 g` al 30 % | `42.83 g` sólido (`ρ=1.04 g/cm³`) / **`~23.6 g`** laminado | Mayor rigidez torsional para MPU6050 |

---

## 4. Distribución de los 5 Componentes, Holguras y Auditoría de Colisiones

Todos los alojamientos incorporan **`+0.50 mm` de holgura física** (o la envolvente `57.8 × 27.6 mm` especificada para el ESP32), rebordes perimetrales de **`1.20 mm` de alto** (`Y = 3.00..4.20 mm`) y ranuras pasacables/sujeción.

| Componente | Medida Nominal (mm) | Alojamiento V7 Nominal (mm) | Centro `(X, Z)` (mm) | Rango `X` / `Z` en Planta (mm) | Luz Libre Mínima a Agujero Columna (`Ø 3.85`) | Luz Libre Mínima a Cajera (`Ø 6.75`) |
|---|---:|---:|---|---|---:|---:|
| **1. Giroscopio MPU6050** | `20.0 × 15.0` | `20.50 × 15.50` | `(0.00, 0.00)` | `X ∈ [-10.25, +10.25]`<br>`Z ∈ [-7.75, +7.75]` | **`8.72 mm`** | **`7.27 mm`** |
| **2. Batería LiPo 3.7 V** | `71.0 × 20.0` | `71.50 × 20.50` | `(-59.75, 0.00)` | `X ∈ [-95.50, -24.00]`<br>`Z ∈ [-10.25, +10.25]` | **`7.85 mm`** (`C1, C3`) | **`6.40 mm`** |
| **3. Elevador MT3608** | `36.0 × 16.0` | `36.50 × 16.50` | `(+43.25, 0.00)` | `X ∈ [+25.00, +61.50]`<br>`Z ∈ [-8.25, +8.25]` | **`9.92 mm`** (`C2, C4`) | **`8.47 mm`** |
| **4. ESP32 ("Sp") + Saliente** | `54.0 × 27.0`<br>+ `3.0 × 17.5` | `54.80 × 27.60`<br>+ `3.00 × 18.00` | `(0.00, -57.90)` | Cuerpo: `X ∈ [-13.80, +13.80]`, `Z ∈ [-86.80, -32.00]`<br>Saliente: `X ∈ [-9.00, +9.00]`, `Z ∈ [-32.00, -29.00]` | **`12.68 mm`** (`C1, C2`) | **`11.23 mm`** |
| **5. Placa Potencia (4 MOSFETs)** | `70.0 × 33.0` | `70.50 × 33.50` | `(0.00, +61.75)` | `X ∈ [-16.75, +16.75]`<br>`Z ∈ [+26.50, +97.00]` | **`8.15 mm`** (`C3, C4`) | **`6.70 mm`** |

### 4.1. Verificación Crítica del Saliente del ESP32 (`3.0 × 17.5 mm`)
- La envolvente con holgura del ESP32 (`57.80 × 27.60 mm`) incorpora el nicho específico del pedazo extra superior (`3.00 × 18.00 mm`) en `X ∈ [-9.00, +9.00] mm, Z ∈ [-32.00, -29.00] mm` (y un nicho simétrico en el extremo opuesto `Z ∈ [-89.80, -86.80] mm` junto a una ventana de `12.0 mm` para acceso directo del puerto USB).
- Distancia euclidiana medida desde la esquina `(±9.00, -29.00)` del saliente hasta el centro de la columna más cercana `C1/C2 (±16.420, -16.420)`: **`14.605 mm`**.
- **Luz libre al agujero pasante (`Ø 3.85 mm`):** `14.605 - 1.925 =` **`12.68 mm`**.
- **Luz libre a la cajera (`Ø 6.75 mm`):** `14.605 - 3.375 =` **`11.23 mm`**.
- **Luz libre geométrica medida en 2D contra el polígono real de la zapata superior de `columna_V_malla_H36m.stl` (`12.00 × 8.50 mm` rotada `45°`):** **`9.89 mm`** (supera con amplio margen el requisito crítico de `≥ 4.00 mm`).

### 4.2. Verificación de No Colisión con `arm-a_pata-motor.stl` y `arm-b_pata-motor.stl`
- **Despeje vertical 3D (`Y`):** los brazos ocupan `Y ∈ [5.10, 23.10] mm` sobre la placa inferior (`Y_max = 23.10 mm` en la raíz diagonal y `14.10 mm` en la zona de motor). Al estar montado el segundo piso sobre las columnas `columna_V_malla_H36m.stl` (`H = 36.00 mm`), la cara inferior del segundo piso se sitúa en `Y = 41.10 mm`, garantizando **`18.00 mm` de luz libre vertical** sobre cualquier punto de los 4 brazos.
- **Despeje en proyección horizontal 2D `(X, Z)` fuera del núcleo central:**
  - Los brazos `arm-a` / `arm-b` inician en `|X| ≥ 19.500 mm` y `|Z| ≥ 15.508 mm` en los 4 cuadrantes diagonales.
  - Las alas laterales `-X / +X` de V7 miden `±15.200 mm` (`±15.291 mm` pre-contracción ABS) y las alas `-Z / +Z` miden `±19.200 mm` (`±19.315 mm` pre-contracción ABS), dejando libres los 4 cuadrantes con una holgura lateral mínima en proyección 2D medida directamente sobre los vértices de `arm-a` de **`10.89 mm`** (alas `±X`) y **`6.89 mm`** (alas `±Z`) fuera del núcleo central octogonal (`|X| + |Z| ≤ 60.00 mm`).

---

## 5. Análisis del Centro de Gravedad (CG) y Balanceo Estructural

1. **Centro de gravedad de la estructura plástica V7 (`04_piso-superior_deck_V7_ABS.stl`):**
   - Medido por integración volumétrica exacta sobre los `13,956` triángulos de la malla cerrada:
     - `CG_X = -0.120 mm` (simetría lateral prácticamente nula `< 0.15 mm`; mejora frente a `+0.473 mm` en V6)
     - `CG_Z = -0.020 mm` (simetría longitudinal `< 0.05 mm`; mejora frente a `-0.151 mm` en V6)
     - `CG_Y = +1.566 mm` (centro vertical de la placa de `3.00 mm` + rebordes `1.20 mm`).
2. **Evaluación estática del piso superior equipado (`~81.6 g` totales con relleno ~30 %):**
   - Al trasladar obligatoriamente el **MPU6050** al origen `(0.00, 0.00) mm` (`~2.0 g`), la **Batería 3.7 V** (`~19.0 g`, `Xc = -59.75 mm`) se desplaza al ala `-X` frente al **MT3608** (`~4.5 g`, `Xc = +43.25 mm`) en el ala `+X`, y en el eje longitudinal la **Placa de Potencia** (`~22.0 g`, `Zc = +61.75 mm`) contrapesa al **ESP32** (`~10.5 g`, `Zc = -57.90 mm`).
   - Esto produce un desplazamiento estático estimado del conjunto superior de `CG_X ≈ -11.56 mm` y `CG_Z ≈ +9.19 mm` respecto al origen (comparable al `CG_Z ≈ +9.13 mm` que ya presentaba V6), con el **sensor MPU6050 alineado exactamente en el centro geométrico `(0, 0)`** para suprimir lecturas falsas por par torsional de las hélices.
   - **Recomendación de ensamblaje y balanceo fino:**
     - El ala `+X` conserva espacio útil libre en `X ∈ [+63.5, +96.0] mm` para alojar el conector de potencia/interruptor o un lastre menor de compensación si se emplea una batería de alta capacidad (`> 22 g`), y la cavidad de `71.5 mm` permite deslizar celdas más cortas hacia el tope interior (`X = -24.0 mm`) reduciendo el brazo de momento en `-X`.
     - Con motores en brazos a `±63.32 mm` (distancia radial `89.55 mm`), un desplazamiento estático `< 12 mm` queda cómodamente compensado por el integrador PID en estacionario sin saturar los canales PWM (`< 18 %` de diferencial de empuje en vuelo estacionario).

---

## 6. Formulación de Compensación Térmica para ABS (`S = 1.006`)

El acrilonitrilo butadieno estireno (**ABS**) presenta una contracción térmica lineal típica entre `0.5 %` y `0.8 %` al enfriarse desde la temperatura de transición vítrea (`~105 °C`) hasta ambiente (`~22 °C`). Para garantizar coincidencia exacta con las columnas y la placa inferior ya impresas se aplicó:

$$X_{\text{STL}} = 1.006 \cdot X_{\text{nom}}, \qquad Z_{\text{STL}} = 1.006 \cdot Z_{\text{nom}}, \qquad Y_{\text{STL}} = Y_{\text{nom}}$$

- **Distancia entre centros de columnas exportada en `04_piso-superior_deck_V7_ABS.stl`:**
  - `ΔX_STL = ΔZ_STL = 32.840 × 1.006 = 33.037 mm` (`±16.519 mm`).
  - Al contraer `0.6 %` tras el enfriamiento (`× 0.994036`): `33.037 / 1.006 =` **`32.840 mm` exactos**.
- **Tolerancia en diámetros internos de anclaje de columnas (`+0.35 mm` + `1.006`):**
  - Agujero pasante: `Ø_nom = 3.50 + 0.35 = 3.85 mm` → exportado en STL como **`Ø 3.873 mm`** (verificado `3.874 mm` por lectura directa de malla).
  - Cajera superior: `Ø_nom = 6.40 + 0.35 = 6.75 mm` → exportado en STL como **`Ø 6.790 mm`** (verificado `6.790 mm` por lectura directa de malla).

---

## 7. Parámetros Recomendados de Laminado en Impresora Creality (ABS)

| Parámetro de Laminado (*Creality Print / Cura / PrusaSlicer*) | Valor Recomendado | Justificación de Ingeniería |
|---|---|---|
| **Orientación en cama de impresión** | Rotar `-90°` en eje `X` (solo si el laminador usa `Z`-up) para apoyar cara plana `Y = 0` sobre la cama | Maximiza superficie de adhesión (`~106 cm²`) y evita soportes en rebordes |
| **Temperatura de extrusor (boquilla)** | **`240 – 245 °C`** | Asegura fusión interlaminar óptima en ABS para resistir vibración de motores |
| **Temperatura de cama caliente** | **`100 °C`** (primera capa `100–105 °C`) | Evita *warping* en las puntas de las alas (`±99.1 mm`) |
| **Patrón y densidad de relleno** | **`25 – 30 %` Giroide** | Rigidez isotrópica en XY y baja transmisión resonante hacia el MPU6050 |
| **Ventilador de capa** | **`0 %`** (apagado durante toda la pieza) | Previene delaminación entre capas y contracción diferencial |
| **Perímetros / Capas superior-inferior** | `3` perímetros (`1.2 mm` con boquilla `0.4 mm`), `4` capas sup/inf (`0.8 mm`) | Relleno sólido en rebordes guía (`1.6 mm` de espesor) y anillos de columna |
| **Altura de capa** | `0.20 mm` | Múltiplo exacto de `3.00 mm` (`15` capas) y `1.20 mm` de reborde (`6` capas) |
| **Adhesión a cama / Recinto** | Falda (*Brim*) `6–8 mm` + recinto cerrado (sin corrientes de aire) | Estabilidad dimensional durante el enfriamiento hasta `< 40 °C` antes de despegar |
