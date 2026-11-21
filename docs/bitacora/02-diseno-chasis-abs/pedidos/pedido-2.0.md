# PEDIDO 2.0 (TRAMO 2): Rediseño Paramétrico Exclusivo del Segundo Piso (`04_piso-superior_deck_V6.stl`) para Impresión en ABS con Ensamblaje Virtual de Columnas

## Regla Obligatoria de Alcance
- Todas las piezas 3D del dron se encuentran en `C:\Dev\Control Dron\Impresiones\`.
- **PROHIBIDO MODIFICAR** los siguientes archivos porque ya están impresos físicamente:
  - `C:\Dev\Control Dron\Impresiones\01_placa-inferior_LIGERA_escotilla.stl`
  - `C:\Dev\Control Dron\Impresiones\03_puerta-escotilla.stl`
  - `C:\Dev\Control Dron\Impresiones\arm-a_pata-motor.stl`
  - `C:\Dev\Control Dron\Impresiones\arm-b_pata-motor.stl`
  - `C:\Dev\Control Dron\Impresiones\columna_V_malla_H36m.stl`
- **ÚNICO ARCHIVO A MODIFICAR:** `C:\Dev\Control Dron\Impresiones\04_piso-superior_deck_V6.stl` (mantener el V6 intacto como respaldo y exportar la nueva versión lista para imprimir como `C:\Dev\Control Dron\Impresiones\04_piso-superior_deck_V7_ABS.stl`).

## Requisitos Técnicos y Dimensionales (Unidades en Milímetros)

### 1. Metrología 3D y Ensamblaje Virtual con el Chasis Ya Impreso
- Usar Python (`trimesh` / `numpy-stl`) para inspeccionar todos los `.stl` de `C:\Dev\Control Dron\Impresiones\`:
  - Medir en `04_piso-superior_deck_V6.stl`, `01_placa-inferior_LIGERA_escotilla.stl` y `columna_V_malla_H36m.stl` (`H = 36 mm`) las **coordenadas exactas `(X, Y)` entre centros de los anclajes/agujeros de las columnas** y el diámetro/perfil de encaje de cada columna.
  - Conservar **idéntica la distancia entre centros de las columnas** para que el segundo piso encaje al 100 % sobre las columnas y la placa inferior ya impresas.
  - Si es necesario ampliar el área útil de la bandeja superior para que quepan todos los componentes sin solaparse, expandir el contorno exterior simétricamente fuera del perímetro de las columnas, evitando chocar con la proyección superior de `arm-a_pata-motor.stl` y `arm-b_pata-motor.stl`.

### 2. Distribución Exacta de los 5 Componentes en el Segundo Piso (Cotas + Holgura + Despeje de Columnas)
Alojar sobre la cara superior de `04_piso-superior_deck_V7_ABS.stl` las 5 áreas de montaje (con guías/rebordes de posicionamiento de `1.2 mm` de alto y ranuras para bridas/cables), aplicando `+0.5 mm` de holgura física y garantizando **cero interferencia con las columnas** (`columna_V_malla_H36m.stl`):
1. **Giroscopio (MPU6050):** `20.0 mm` largo × `15.0 mm` ancho (área de alojamiento: `20.5 × 15.5 mm`). **Obligatorio:** ubicarlo exactamente en el **centro geométrico `(X=0, Y=0)`** del dron para evitar lecturas erróneas por vibración y par torsional.
2. **Batería 3.7 V:** `71.0 mm` largo × `20.0 mm` ancho (área de alojamiento: `71.5 × 20.5 mm`), alineada simétricamente para conservar el centro de gravedad equilibrado.
3. **Elevador de Voltaje (MT3608):** `36.0 mm` largo × `16.0 mm` ancho (área de alojamiento: `36.5 × 16.5 mm`), ubicado entre la batería y el ESP32 con acceso libre al tornillo de calibración.
4. **ESP32 ("Sp") + Pedazo Extra Superior:**
   - Cuerpo principal del ESP32: `54.0 mm` largo × `27.0 mm` ancho.
   - **Pedazo extra sobre el ESP32:** `3.0 mm` largo × `17.5 mm` ancho (envolvente total con holgura: `57.8 × 27.6 mm`).
   - **Restricción crítica:** orientar y posicionar el ESP32 de modo que el pedazo extra de `3.0 × 17.5 mm` quede totalmente despejado (mínimo `4.0 mm` de luz libre) respecto a las columnas `columna_V_malla_H36m.stl` y soportes impresos.
5. **Placa Perforada de Potencia (4 MOSFETs IRFZ44N + 4 Diodos):** `70.0 mm` largo × `33.0 mm` ancho (área de alojamiento: `70.5 × 33.5 mm`), ubicada con ranuras pasacables en los bordes para bajar los cables `M+` y `M-` hacia los 4 brazos.

### 3. Compensación Térmica para Impresión en ABS
- Aplicar factor de escala `1.006` (`+0.6 %` en X e Y) para compensar la contracción térmica del **filamento ABS** al enfriarse, asegurando que al salir de la impresora Creality las distancias entre centros de columnas coincidan exactamente con la placa inferior ya impresa, y añadir `+0.35 mm` de tolerancia en el diámetro interno de los agujeros de las columnas.

### 4. Entregables Técnicos y Verificación Visual
1. Script paramétrico reproducible en `C:\Dev\Control Dron\Impresiones\generar_piso_superior_v7.py`.
2. Nuevo archivo STL listo para laminar en `C:\Dev\Control Dron\Impresiones\04_piso-superior_deck_V7_ABS.stl`.
3. Plano técnico 2D a escala real (`1:1` en mm) en `C:\Dev\Control Dron\Impresiones\plano-verificacion-piso-superior-V7.svg` superponiendo el contorno de la placa inferior, la huella exacta de las columnas (`columna_V_malla_H36m.stl`), los 5 componentes acotados (incluyendo el saliente de `3.0 × 17.5 mm` del ESP32) y las cotas de distancia libre.
4. Informe de ingeniería del Tramo 2 en `C:\Dev\Control Dron\Tramos\2do\Informes\informe-2.0.md` (formato listo para anexar al informe UDES) con la tabla comparativa de medidas V6 vs. V7, verificación de colisiones con columnas, balanceo del centro de gravedad, compensación térmica ABS (`1.006`) y parámetros de laminado en Creality (extrusor `240–245 °C`, cama `100 °C`, relleno `25–30 %` giroide, ventilador de capa `0 %`).