# PEDIDO 2.1 (TRAMO 2): Ajuste Dimensional Exacto sobre el Diseño Original `04_piso-superior_deck_V6.stl` para Impresión en ABS

## Regla Obligatoria de Diseño y Alcance
- **NO inventar una geometría nueva.** Tomar como molde exacto la forma en cruz aligerada (con sus vaciados triangulares/trapezoidales y nervios) de `C:\Dev\Control Dron\Impresiones\04_piso-superior_deck_V6.stl`.
- **PROHIBIDO MODIFICAR** las piezas ya impresas en `C:\Dev\Control Dron\Impresiones\`:
  - `01_placa-inferior_LIGERA_escotilla.stl`
  - `03_puerta-escotilla.stl`
  - `arm-a_pata-motor.stl`
  - `arm-b_pata-motor.stl`
  - `columna_V_malla_H36m.stl`
  - `04_piso-superior_deck_V6.stl` (conservar como respaldo)
- **ARCHIVOS A GENERAR:**
  - `C:\Dev\Control Dron\Impresiones\04_piso-superior_deck_V6_ABS.stl` (el diseño V6 con las medidas corregidas y compensación ABS)
  - `C:\Dev\Control Dron\Impresiones\plano-verificacion-piso-superior-V6-ABS.svg`
  - `C:\Dev\Control Dron\Tramos\2do\Informes\informe-2.1.md`

## Ubicación y Medidas Exactas de Cada Alojamiento (Respetando el Layout del V6)
Medir en Python (`trimesh` / `numpy-stl`) la geometría exacta de `04_piso-superior_deck_V6.stl`, `01_placa-inferior_LIGERA_escotilla.stl` y `columna_V_malla_H36m.stl` para conservar **idénticas las coordenadas `(X, Y)` de los 4 anclajes de las columnas** en las esquinas del rectángulo central, y ajustar los 5 alojamientos del V6 a las siguientes medidas reales (incluyendo `+0.5 mm` de holgura física de montaje):

1. **Rectángulo Central — Batería 3.7 V:**
   - Medida real: `71.0 mm` largo × `20.0 mm` ancho (con holgura: `71.5 × 20.5 mm`).
   - Mantener el rectángulo central calado de V6 ajustado a esta cota exacta para concentrar el mayor peso en el centro de gravedad.
2. **Ala Superior — ESP32 ("Sp") + Pedazo Extra Superior:**
   - Cuerpo principal: `54.0 mm` largo × `27.0 mm` ancho (con holgura: `54.5 × 27.5 mm`).
   - **Pedazo extra sobre el extremo superior del ESP32:** `3.0 mm` largo × `17.5 mm` ancho (con holgura: `3.2 × 18.0 mm`), ubicado **únicamente en el ala superior** para la antena Wi-Fi, verificando que no choque con las 2 columnas superiores.
   - Mantener las **2 ranuras pasantes longitudinales** en el alojamiento del ESP32 para que sus pines atraviesen hacia abajo y permitan conectar los jumpers entre pisos.
3. **Ala Inferior — Placa Perforada de Potencia (MOSFETs):**
   - Medida real: `70.0 mm` largo × `33.0 mm` ancho (con holgura: `70.5 × 33.5 mm`).
   - Ajustar el ancho y largo del ala inferior del V6 para que la placa de `70 × 33 mm` encaje perfecta sin tocar las 2 columnas inferiores, conservando los vaciados triangulares de aligeramiento y dejando el borde inferior limpio (sin el pedazo extra de `3.0 × 17.5 mm` que solo va arriba en el ESP32).
4. **Ala Izquierda — Elevador de Voltaje MT3608:**
   - Medida real: `36.0 mm` largo × `16.0 mm` ancho (con holgura: `36.5 × 16.5 mm`).
   - Conservar la estructura aligerada con huecos triangulares del ala izquierda de V6 ajustada a esta dimensión.
5. **Ala Derecha — Giroscopio MPU6050:**
   - Medida real: `20.0 mm` largo × `15.0 mm` ancho (con holgura: `20.5 × 15.5 mm`).
   - Conservar la estructura aligerada con huecos triangulares del ala derecha de V6 ajustada a esta dimensión, equilibrando lateralmente el peso del elevador.

## Compensación Térmica para Impresión en ABS
- Aplicar factor de escala `1.006` (`+0.6 %` en X e Y) para compensar la contracción térmica del **ABS** al enfriarse en la impresora Creality y añadir `+0.35 mm` de tolerancia en los 4 agujeros/anclajes de las columnas.
- Documentar los ajustes realizados sobre el diseño V6 en `C:\Dev\Control Dron\Tramos\2do\Informes\informe-2.1.md`.