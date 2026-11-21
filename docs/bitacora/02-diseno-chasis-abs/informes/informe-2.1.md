# INFORME TÉCNICO 2.1 (TRAMO 2): Ajuste Dimensional Exacto sobre `04_piso-superior_deck_V6.stl` para Impresión en ABS (`04_piso-superior_deck_V6_ABS.stl`)

## 1. Resumen Ejecutivo de Ingeniería
En cumplimiento estricto del **Pedido 2.1 (Tramo 2)**, se tomó como molde geométrico directo el diseño cruciforme aligerado de `C:\Dev\Control Dron\Impresiones\04_piso-superior_deck_V6.stl`, conservando al `100 %` su silueta en cruz, sus vaciados triangulares/trapezoidales de aligeramiento, sus postes M2, sus escuadras en L (`Y = 3.00..6.00 mm`) y las coordenadas nominales `(X, Z)` de las 4 columnas medidas respecto a `01_placa-inferior_LIGERA_escotilla.stl` y `columna_V_malla_H36m.stl`, sin modificar ninguno de los 6 archivos `.stl` originales ya impresos.

Los entregables generados y verificados en `C:\Dev\Control Dron\` son:
1. **Generador y auditor metrológico reproducible:** [`generar_piso_superior_v6_abs.py`](file:///C:/Dev/Control%20Dron/Impresiones/generar_piso_superior_v6_abs.py)
2. **Modelo 3D listo para laminar en ABS:** [`04_piso-superior_deck_V6_ABS.stl`](file:///C:/Dev/Control%20Dron/Impresiones/04_piso-superior_deck_V6_ABS.stl) (`13,344` triángulos, `667,284` bytes, malla cerrada *2-manifold* verificada con `0` aristas abiertas, `0` aristas no-manifold y `0` discrepancias de orientación)
3. **Plano técnico de verificación 2D escala 1:1 (mm):** [`plano-verificacion-piso-superior-V6-ABS.svg`](file:///C:/Dev/Control%20Dron/Impresiones/plano-verificacion-piso-superior-V6-ABS.svg)
4. **Presente informe técnico:** [`informe-2.1.md`](file:///C:/Dev/Control%20Dron/Tramos/2do/Informes/informe-2.1.md)

---

## 2. Metrología de Referencia e Integridad de Piezas Originales (Solo Lectura)

La auditoría binaria directa confirma que las 6 piezas `.stl` originales en `C:\Dev\Control Dron\Impresiones\` permanecen intactas (plano horizontal `X–Z`, eje vertical `Y`):

| Archivo STL Original (Intacto) | Tamaño (bytes) | Triángulos | Rango `X` (mm) | Rango `Y` vertical (mm) | Rango `Z` (mm) | Datos Metrológicos Extraídos |
|---|---:|---:|---|---|---|---|
| `01_placa-inferior_LIGERA_escotilla.stl` | 824,884 | 16,496 | `[-43.47, +43.47]` | `[-3.50, +8.10]` | `[-69.00, +45.00]` | Base inferior con anclajes internos de columnas |
| `03_puerta-escotilla.stl` | 44,184 | 882 | `[-14.40, +14.40]` | `[-3.50, +3.00]` | `[-17.55, +18.50]` | Tapa inferior |
| `arm-a_pata-motor.stl` | 110,684 | 2,212 | `[+19.50, +75.55]` | `[+5.10, +23.10]` | `[+15.51, +75.55]` | Brazo derecho (`\|X\| >= 19.50 mm`, `Y_max = 23.10 mm`) |
| `arm-b_pata-motor.stl` | 111,384 | 2,226 | `[-75.55, -19.50]` | `[+5.10, +23.10]` | `[+15.51, +75.55]` | Brazo izquierdo simétrico (`\|X\| >= 19.50 mm`, `Y_max = 23.10 mm`) |
| `columna_V_malla_H36m.stl` | 96,584 | 1,930 | `[-8.00, +21.25]` | `[0.00, +36.00]` | `[-4.25, +4.25]` | Altura `H = 36.00 mm`; zapata superior `12.00 × 8.50 mm` |
| `04_piso-superior_deck_V6.stl` | 673,784 | 13,474 | `[-77.00, +77.00]` | `[0.00, +8.00]` | `[-89.00, +94.00]` | Molde base con `44` lazos en `Y=0` y `4` columnas en `(±16.422, ±16.422)` |

### 2.1. Preservación Exacta de las 4 Columnas (`C1..C4`)
De `04_piso-superior_deck_V6.stl` se extrajeron directamente los centros de los 4 agujeros pasantes de columna en `(±16.422, ±16.422) mm` (nominal `(±16.420, ±16.420) mm`), correspondientes al desplazamiento en `45°` de `columna_V_malla_H36m.stl` desde la placa inferior (`01_placa-inferior_LIGERA_escotilla.stl`):

- **Centros nominales post-contracción (`C1..C4`):** `(-16.420, -16.420)`, `(+16.420, -16.420)`, `(-16.420, +16.420)`, `(+16.420, +16.420) mm`.
- **Distancia entre centros nominal:** `ΔX = 32.840 mm`, `ΔZ = 32.840 mm`.
- **Centros exportados en `04_piso-superior_deck_V6_ABS.stl` (`× 1.006`):** `(±16.519, ±16.519) mm` (`ΔX_STL = ΔZ_STL = 33.037 mm`).
- **Tolerancia `+0.35 mm` en agujeros y cajeras (verificada por lectura directa del STL generado):**
  - Agujero pasante (`Y = 0.00..1.40 mm`): `Ø 3.50 + 0.35 = 3.850 mm` nominal → **`Ø 3.873 mm`** en STL (`1.006 × 3.850 = 3.8731 mm`).
  - Cajera superior (`Y = 1.40..2.95..3.00 mm`): `Ø 6.40 + 0.35 = 6.750 mm` nominal → **`Ø 6.790 mm`** en STL (`1.006 × 6.750 = 6.7905 mm`).

---

## 3. Comparativa Técnica: `04_piso-superior_deck_V6.stl` vs. `04_piso-superior_deck_V6_ABS.stl`

| Característica / Alojamiento | `04_piso-superior_deck_V6.stl` (Molde Original) | `04_piso-superior_deck_V6_ABS.stl` (Ajustado ABS) | Ajuste Aplicado |
|---|---|---|---|
| **Envolvente nominal `(X × Z)`** | `154.00 × 183.00 mm` (`[-77,+77] × [-89,+94]`) | `157.00 × 190.00 mm` (`[-80,+77] × [-90.5,+99.5]`) | Ajuste mínimo solo en puntas `-X`, `-Z` y ala `+Z` |
| **Envolvente exportada STL (`×1.006`)** | `154.00 × 183.00 mm` (sin compensar) | `157.94 × 191.14 mm` (`[-80.480,+77.462] × [-91.043,+100.097]`) | Compensación térmica ABS `+0.6 %` en `X` y `Z` |
| **Espesor placa / escuadras / postes (`Y`)** | `3.00 mm` / `3.00..6.00 mm` / `3.00..8.00 mm` | `3.00 mm` / `3.00..6.00 mm` / `3.00..8.00 mm` | Idéntico al molde V6 |
| **1. Rectángulo Central — Batería 3.7 V** | Escuadras `76.00 × 22.80 mm` (topes en `±40.0` chocaban con `+X`) | **`71.50 × 20.50 mm`** (`71.0 × 20.0 + 0.5 mm`, `X∈[-35.75,+35.75]`, `Z∈[-10.25,+10.25]`) | 4 escuadras ajustadas + 4 vaciados triangulares `L20..L23` + 4 ranuras Velcro `L13,L14,L32,L33` |
| **2. Ala Superior (`-Z`) — ESP32 ("Sp")** | `55.90 × 28.80 mm` sin nicho extra ni ranuras largas de pines | **`54.50 × 27.50 mm`** (`54.0 × 27.0 + 0.5 mm`) + **pedazo extra `3.20 × 18.00 mm`** (`3.0 × 17.5`) + **2 ranuras pasantes `50.5 × 2.5 mm`** | Pedazo extra **solo arriba** (`Z∈[-85.45,-82.25]`); ranuras pines en `X∈[-12.75,-10.25]` y `[+10.25,+12.75]`; vaciados `L02..L04` al centro |
| **3. Ala Inferior (`+Z`) — Placa Potencia** | Ancho `34.00 mm`, postes a `63.0 mm` (`Z=23.5/86.5`) | **`70.50 × 33.50 mm`** (`70.0 × 33.0 + 0.5 mm`, `X∈[-16.75,+16.75]`, `Z∈[+22.50,+93.00]`) | Ala ensanchada a `37.50 mm` (`±18.75`); 4 postes M2 en `(±12.75, +26.25/+89.25)`; vaciados `L38,L40..L43`; **borde inferior limpio** |
| **4. Ala Izquierda (`-X`) — MT3608** | Bahía de `21.80 × 16.80 mm` (MPU en V6) | **`36.50 × 16.50 mm`** (`36.0 × 16.0 + 0.5 mm`, `X∈[-76.50,-40.00]`, `Z∈[-8.25,+8.25]`) | Punta `-X` extendida `-3.0 mm` a `-80.0 mm`; 4 escuadras L + 2 vaciados `L24,L25` + 4 ojales brida |
| **5. Ala Derecha (`+X`) — MPU6050** | Bahía de `32.80 × 17.80 mm` (MT3608 en V6) | **`20.50 × 15.50 mm`** (`20.0 × 15.0 + 0.5 mm`, `X∈[+44.75,+65.25]`, `Z∈[-7.75,+7.75]`) | 4 escuadras L + 2 vaciados internos `L26,L27` + 3 vaciados periféricos `L15,L16,L31` + 2 ojales brida |
| **Topología y masa sólida (`ρ=1.04 g/cm³`)** | `13,474` tris, `19.423 cm³`, `20.20 g` | `13,344` tris, `22.485 cm³`, `23.38 g` (`0` bordes abiertos) | Malla 2-manifold cerrada (`~12.8 g` al `30 %` relleno) |

---

## 4. Verificación de Alojamientos, Vaciados Aligerados, Pines y Colisiones

### 4.1. Preservación de Vaciados Triangulares/Trapezoidales del Molde V6
Se extrajeron los `44` lazos poligonales cerrados de la base `Y = 0.0 mm` de `04_piso-superior_deck_V6.stl`:
- **Cartelas diagonales del núcleo central (`L05, L06, L07, L09, L10, L34, L37, L39`):** conservadas sin alterar alrededor de los 4 anclajes de columnas `(±16.42, ±16.42) mm`.
- **Rectángulo central (`L20, L21, L22, L23`):** los 4 triángulos redondeados de la cruz en `X` se reescalaron proporcionalmente al nuevo claro interno (`X ∈ [-33.75, +33.75] mm, Z ∈ [-8.25, +8.25] mm`), manteniendo intactas las 4 ranuras Velcro (`L13, L14, L32, L33`).
- **Ala superior ESP32 (`L02, L03, L04` + 2 ranuras de pines):** los 3 vaciados triangulares centrales se ajustaron al corredor `X ∈ [-8.25, +8.25] mm, Z ∈ [-80.25, -29.75] mm`, dejando a cada lado un nervio de `2.00 mm` y las **2 ranuras pasantes longitudinales (`50.50 × 2.50 mm`)** en `X ∈ [-12.75, -10.25]` y `[+10.25, +12.75] mm` para el paso libre de los pines y conexión de *jumpers* entre pisos.
- **Ala inferior placa potencia (`L38, L40, L41, L42, L43`):** se conservaron los vaciados triangulares del corredor inferior y sus 2 ventanas rectangulares (`L40, L41` en `Z ∈ [26.75, 32.75] mm`), manteniendo los 4 postes M2 (`Ø 6.00 mm` ext. / `Ø 1.80 mm` int.) en `(±12.75, 26.25)` y `(±12.75, 89.25)`. El extremo `+Z` queda completamente limpio sin el saliente `3.0 × 17.5 mm`.
- **Alas laterales (`L24, L25` en `-X`; `L26, L27, L15, L16, L31` en `+X`):** se adaptaron las celosías triangulares de V6 a la longitud de cada módulo (`36.5 × 16.5 mm` en ala izquierda `-X` para MT3608 y `20.5 × 15.5 mm` en ala derecha `+X` para MPU6050).

### 4.2. Auditoría de Luces Libres a Columnas (`C1..C4`) y Brazos (`arm-a` / `arm-b`)

| Alojamiento (con holgura `+0.5 mm`) | Rango Nominal `(X, Z)` (mm) | Luz Libre Mínima a Agujero Columna (`Ø 3.85 mm`) | Luz Libre Mínima a Cajera (`Ø 6.75 mm`) | Luz Libre 2D a Zapata Superior (`12.0 × 8.5 mm`) |
|---|---|---:|---:|---:|
| **Batería 3.7 V (Centro)** | `X ∈ [-35.75, +35.75]`, `Z ∈ [-10.25, +10.25]` | `4.25 mm` | `2.80 mm` | `1.08 mm` |
| **ESP32 ("Sp") (Ala `-Z`)** | `X ∈ [-13.75, +13.75]`, `Z ∈ [-82.25, -27.75]` | `9.72 mm` | `8.27 mm` | `5.65 mm` |
| **Pedazo extra antena (solo `-Z`)** | `X ∈ [-9.00, +9.00]`, `Z ∈ [-85.45, -82.25]` | `64.32 mm` | `62.87 mm` | `59.22 mm` |
| **Placa Potencia (Ala `+Z`)** | `X ∈ [-16.75, +16.75]`, `Z ∈ [+22.50, +93.00]` | `4.15 mm` | `2.70 mm` | `0.18 mm` (debajo en `Y`) |
| **Elevador MT3608 (Ala `-X`)** | `X ∈ [-76.50, -40.00]`, `Z ∈ [-8.25, +8.25]` | `23.03 mm` | `21.58 mm` | `18.85 mm` |
| **Giroscopio MPU6050 (Ala `+X`)** | `X ∈ [+44.75, +65.25]`, `Z ∈ [-7.75, +7.75]` | `27.70 mm` | `26.25 mm` | `23.29 mm` |

- **Despeje con brazos `arm-a_pata-motor.stl` y `arm-b_pata-motor.stl`:**
  - **Despeje vertical (`Y`):** los brazos alcanzan como máximo `Y_max = 23.10 mm` mientras la cara inferior del segundo piso se apoya a `5.10 + 36.00 = 41.10 mm` (`18.00 mm` de luz libre vertical).
  - **Despeje en proyección 2D (`X–Z`):** los brazos comienzan en `|X| >= 19.500 mm`; el ala inferior ensanchada a `±18.75 mm` (`Z ∈ [36.00, 99.50] mm`) conserva **`1.889 mm`** de luz libre horizontal respecto a los vértices de los brazos.

### 4.3. Balanceo Estático y Centro de Gravedad (CG)
- **CG de la estructura plástica `04_piso-superior_deck_V6_ABS.stl`:** `X = -1.316 mm`, `Y = +1.748 mm`, `Z = +2.595 mm`.
- **CG estático estimado del piso superior equipado (`70.80 g` totales con plástico al `~30 % ≈ 12.8 g`, batería `19.0 g` centrada en `(0,0)`, ESP32 `10.5 g` en `-55.0 mm`, placa potencia `22.0 g` en `+57.75 mm`, MT3608 `4.5 g` en `-58.25 mm` y MPU6050 `2.0 g` en `+55.00 mm`):**
  - `CG_X = -2.39 mm` (excelente simetría lateral al mantener la batería en el rectángulo central `(0, 0)`), `CG_Z = +10.26 mm`.

---

## 5. Compensación Térmica ABS (`1.006`) y Parámetros de Impresión Creality

1. **Escala aplicada al STL:** `X_STL = 1.006 · X_nom`, `Z_STL = 1.006 · Z_nom`, `Y_STL = Y_nom`.
2. **Parámetros recomendados en *Creality Print / Cura* para filamento ABS:**
   - **Orientación:** apoyar la cara plana `Y = 0.00 mm` sobre la cama (si el laminador usa `Z`-arriba, rotar `-90°` en `X`).
   - **Temperatura de boquilla:** `240 – 245 °C`.
   - **Temperatura de cama:** `100 °C` (primera capa `100 – 105 °C`) con *brim* de `6 – 8 mm` y recinto cerrado sin corrientes de aire.
   - **Relleno y perímetros:** `25 – 30 %` patrón **giroide**, `3` perímetros (`1.2 mm` con boquilla `0.4 mm`), altura de capa `0.20 mm` (`15` capas exactas para la placa de `3.00 mm` y `15` capas para escuadras de `3.00 mm`).
   - **Ventilador de capa:** `0 %` durante toda la impresión.
