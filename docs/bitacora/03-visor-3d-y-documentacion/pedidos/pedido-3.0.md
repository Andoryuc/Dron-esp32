# PEDIDO 3.0 (TRAMO 3): Visor y Animación 3D Interactiva Fiel al Prototipo Real sobre Fondo Blanco Puro

## Objetivo y Alcance Estricto
Construir en `C:\Dev\Control Dron\presentacion-3d\` una aplicación web 3D profesional en Three.js, **100% offline** (sin depender de internet ni CDN externos), que muestre el modelo 3D interactivo y movible de nuestro dron cuadricóptero de doble nivel sobre un **fondo blanco puro (`#FFFFFF`)**, replicando con máxima fidelidad visual el ensamblaje físico real documentado en nuestras fotografías y archivos `.stl`.

**Alcance exclusivo de este Pedido 3.0:**
- Enfocarse únicamente en la fidelidad del ensamblaje 3D con los 5 `.stl` reales, materiales realistas, electrónica idéntica en ubicación y orientación a las fotos reales, cableado 3D limpio y ordenado, animaciones suaves de cámara/hélices/despiece y control libre 360°.
- **NO** implementar todavía las secciones de datasheets, galería de avances, diagrama de circuito ni textos extensos (se integrarán en el Pedido 3.1 sobre esta misma base modular).
- **PROHIBIDO MODIFICAR** ningún archivo `.stl`, foto o video original, ni los archivos del firmware ESP32, simulador o App de los Tramos 1 y 2.

---

## 1. Fuentes Exactas de Entrada (SOLO Lectura)

### A. Los 5 Archivos `.stl` Reales Impresos (`C:\Dev\Control Dron\Tramos\3ro\STL\`)
Usar exclusivamente estos 5 archivos (no buscar ni cargar piezas que no estén en esta lista):
1. `01_placa-inferior_LIGERA_escotilla.stl` — Base estructural del Piso 1 (x1).
2. `04_piso-superior_deck_V6_ABS.stl` — Bandeja en cruz del Piso 2 (x1).
3. `arm-a_pata-motor.stl` — Brazos/soportes de motor diagonal A (x2).
4. `arm-b_pata-motor.stl` — Brazos/soportes de motor diagonal B (x2).
5. `columna_V_malla_H36m.stl` — Columnas estructurales en V de 36 mm de altura (x4).

**Inspección metrológica obligatoria antes de ensamblar:**
- Ejecutar un script breve en Python o Node.js para extraer el `bounding box` (X, Y, Z en mm), centro geométrico y coordenadas exactas de los 4 anclajes de columnas en `01_placa-inferior_LIGERA_escotilla.stl`, `columna_V_malla_H36m.stl` y `04_piso-superior_deck_V6_ABS.stl`.
- Verificar que los 4 brazos (`arm-a` y `arm-b`), las 4 columnas de 36 mm y el piso superior encajen con precisión milimétrica sin flotar, sin rotaciones invertidas y sin colisiones.
- Copiar únicamente esos 5 `.stl` a `C:\Dev\Control Dron\presentacion-3d\assets\stl\` para que la app sea autocontenida.

### B. Referencia Visual Real (`C:\Dev\Control Dron\Tramos\3ro\fotos y videos reales\`)
- Inspeccionar varias fotos representativas de esa carpeta (vistas superiores cenitales, vista frontal del ESP32, vista trasera de la baquelita de MOSFETs, vista lateral del MT3608 y vista lateral del MPU-6050) para verificar al 100 %:
  - La orientación exacta de los 4 brazos respecto al chasis y los 4 tornillos metálicos que atraviesan hacia abajo como topes/patas de apoyo.
  - La posición, orientación, colores y proporciones exactas de cada componente electrónico montado sobre `04_piso-superior_deck_V6_ABS.stl`.
  - El estilo exacto de las hélices negras con doble franja blanca en las puntas.
  - La paleta real de colores de los cables (pero corrigiendo los bucles sueltos por un tendido limpio de ingeniería).

---

## 2. Escena 3D, Iluminación de Estudio y Fondo Blanco Puro
- **Fondo obligatorio:** Blanco puro `#FFFFFF` limpio, sin cuadrículas de piso, sin horizontes grises ni objetos de fondo.
- **Iluminación de estudio de producto:** Combinación de `HemisphereLight`, luz direccional clave suave con sombra sutil proyectada sobre un plano receptor transparente (`ShadowMaterial` con opacidad `~0.09` debajo del dron) y luz de contorno (`rim light`) que destaque los relieves y aristas del ABS negro mate.
- **Materiales realistas:**
  - Piezas `.stl` en ABS negro mate texturizado (`#181b20`, `roughness: 0.56`, `metalness: 0.08`).
  - Cabezas de tornillos Phillips plateados en los 4 anclajes centrales del chasis y espárragos/tornillos inferiores visibles debajo de los brazos, tal como se aprecian en las fotos reales.

---

## 3. Electrónica 3D Idéntica al Prototipo Real (Sobre `04_piso-superior_deck_V6_ABS.stl`)
Modelar en 3D con detalle limpio cada componente exactamente en su ala correspondiente del deck V6:
1. **Portabaterías 18650 (Rectángulo central):**
   - Caja negra de 1 celda 18650 centrada longitudinalmente, con resorte plateado hacia el lado del elevador MT3608 y terminal metálico dorado hacia el lado del MPU-6050.
   - Incluir la batería cilíndrica Li-Ion 18650 (`65 × 18 mm`) con botón en la UI para mostrarla u ocultarla (permitiendo ver el portabaterías vacío exactamente como en las fotos).
2. **Microcontrolador ESP32-WROOM-32D (Ala delantera, montado boca arriba):**
   - PCB negro (`54 × 27 mm`), blindaje metálico plateado RF orientado hacia el centro del dron, puerto Micro-USB y botones `EN`/`BOOT` en el extremo exterior, y pines atravesando hacia abajo por las ranuras del piso superior.
3. **Placa Perforada de Potencia — 4 MOSFETs IRFZ44N + 4 Diodos Flyback (Ala trasera, opuesta al ESP32):**
   - Baquelita perforada color ocre/café claro (`70 × 33 mm`) fijada en sus esquinas con tornillos y arandelas metálicas (con ligero tinte verdoso/metálico como en las fotos).
   - 4 MOSFETs **IRFZ44N (TO-220)** alineados en fila sobre el costado interno (cuerpo negro vertical con pestaña metálica plateada perforada mirando hacia afuera), 4 diodos negros cilíndricos con banda plateada y puentes cortos rojos y negros sobre la placa.
4. **Elevador de Voltaje MT3608 (Ala lateral junto al resorte del portabaterías):**
   - PCB azul (`36 × 16 mm`) con inductor negro cilíndrico/cuadrado (`220`) hacia el interior, potenciómetro azul con tornillo dorado de ajuste hacia el borde exterior y terminales `VIN+/VIN-/VOUT+/VOUT-` con brida negra de sujeción.
5. **Giroscopio MPU-6050 (Ala lateral opuesta al MT3608, junto al polo positivo dorado):**
   - PCB azul (`20 × 15 mm`) con chip QFN negro central y peine de 8 pines metálicos horizontales alineados hacia el borde.
6. **4 Motores DC + 4 Hélices Bi-Pala Negras con Doble Franja Blanca (En las puntas de los 4 brazos):**
   - Carcasas cilíndricas de los 4 motores encajadas en los extremos de `arm-a` y `arm-b`.
   - 4 hélices negras bi-pala con franjas blancas nítidas cerca de cada punta (como en las fotos reales), rotando en sus sentidos reales (`M1 Del. Izq = CW`, `M2 Del. Der = CCW`, `M3 Tras. Izq = CCW`, `M4 Tras. Der = CW`).

---

## 4. Cableado 3D Ordenado y Ultra Limpio (`CatmullRomCurve3` + `TubeGeometry`)
Conservar los colores reales de los cables visibles en las fotos, pero **reemplazando los arcos altos y sueltos por un arnés de ingeniería limpio, pegado al chasis y ordenado**, especialmente en el paso entre el 2.º piso y el 1.º piso:
- **Alimentación MT3608 ↔ Batería y ESP32 (cables naranja y gris oscuro):** Curvas cortas, bajas y paralelas saliendo de `VIN+/VIN-` y `VOUT+/VOUT-` con pequeñas abrazaderas negras estilizadas, entrando ordenadamente hacia el portabaterías y hacia los pines `5V/GND` del ESP32 sin formar bucles altos.
- **Potencia principal B+ / B− (rojo y negro):** Trazado limpio y pegado al deck desde el portabaterías hacia los buses de la baquelita de MOSFETs.
- **4 señales PWM (cinta de 4 hilos blancos paralelos):** Saliendo por debajo de las ranuras del ESP32 (`GPIO 25, 26, 27, 14`), viajando peinados por debajo del segundo piso y subiendo limpiamente a los 4 Gates de los IRFZ44N.
- **Bus I2C del MPU-6050 (4 hilos finos agrupados):** Rutados ordenadamente por debajo del segundo piso hacia `3V3, GND, GPIO 21, GPIO 22` del ESP32.
- **Cables de motores (hilos blanco/gris/café/negro):** Bajando pegados a la cara interna de las columnas desde la placa de MOSFETs y entrando por el canal interior de cada brazo hasta los 4 motores, sin sobresalir ni colgar.

---

## 5. Controles Interactivos, Animación de Cámara y Modo Exposición
Interfaz flotante minimalista (fondo translúcido claro que armonice con el blanco puro):
- **Movimiento libre 360° (`OrbitControls`):** Rotar con arrastre, zoom con rueda y paneo con clic derecho, amortiguación suave (`enableDamping = true`).
- **Barra inferior de Vistas de Cámara (transición animada suave de `900 ms`):**
  - `General` (3/4 isométrica)
  - `Superior` (cenital)
  - `Perfil` (lateral mostrando los 2 pisos y columnas de 36 mm)
  - `ESP32`
  - `MOSFETs`
  - `MT3608`
  - `MPU-6050`
- **Panel compacto superior derecho:**
  - **Hélices:** `OFF` / `Ralentí` / `Vuelo`
  - **Despiece (Vista Explosionada):** Toggle o slider `0% → 100%` que separa suavemente en vertical el 2.º piso, las columnas, la batería y el 1.º piso para mostrar el espacio interno y el cableado limpio.
  - **Batería:** `Mostrar / Ocultar` (para comparar con las fotos reales del portabaterías vacío).
  - **Auto-Giro:** `ON / OFF`
  - **Modo Limpio (Tecla `H`):** Oculta todos los botones dejando solo el dron 3D flotando en pantalla blanca pura.
- **Estructura modular lista para Pedido 3.1:** Dejar un módulo separado (`js/panels-slot.js` o similar) vacío y conectado al layout donde en el Pedido 3.1 se agregarán las pestañas de Datasheets, Fotos de Avances, Circuito de Conexiones y Explicación de Elementos Físicos sin tocar el motor 3D.

---

## 6. Ejecución 100% Offline en Windows
- Descargar y guardar localmente `three.module.js`, `OrbitControls.js` y `STLLoader.js` en `C:\Dev\Control Dron\presentacion-3d\vendor\three\`.
- Crear servidor local ligero en Node.js (`C:\Dev\Control Dron\presentacion-3d\servir.js`, puerto `3030`) y lanzador de doble clic `C:\Dev\Control Dron\presentacion-3d\ABRIR-ANIMACION-3D.bat` que inicie el servidor y abra `http://localhost:3030`.

---

## 7. Informe del Tramo 3.0 (`C:\Dev\Control Dron\Tramos\3ro\Informes\informe-3.0.md`)
Documentar:
1. Metrología (`bounding box` en mm) y transformaciones exactas aplicadas a los 5 `.stl` reales.
2. Qué fotos reales de `Tramos\3ro\fotos y videos reales\` se tomaron como referencia visual para validar orientación y detalles.
3. Estructura de archivos en `presentacion-3d/` y verificación de arranque offline con `ABRIR-ANIMACION-3D.bat`.