# Informe Técnico — Pedido 3.0 (Tramo 3): Visor y Animación 3D Interactiva Fiel al Prototipo Real

**Fecha:** 2026-11-20  
**Aplicación generada:** `C:\Dev\Control Dron\presentacion-3d\`  
**Estado:** Completado y verificado localmente en navegador (`http://localhost:3030`) en modo 100% offline.

---

## 1. Metrología y Transformaciones Exactas de los 5 `.stl` Reales

Se inspeccionaron directamente los 5 archivos `.stl` binarios originales ubicados en `C:\Dev\Control Dron\Tramos\3ro\STL\` (sin modificar ninguno de los originales; copiados únicamente a `presentacion-3d\assets\stl\`).  
Sistema de coordenadas adoptado: **`1 unidad Three.js = 1 mm`** (sistema diestro `+Y` arriba, `-Z` frente / ala ESP32, `+Z` atrás / ala MOSFETs y escotilla, `-X` izquierda / ala MT3608, `+X` derecha / ala MPU-6050).

### A. Resumen Metrológico (`Bounding Box` Nativo en mm)

| Archivo `.stl` | Triángulos | Tamaño | Rango X (mm) | Rango Y (mm) | Rango Z (mm) | Dimensiones `X × Y × Z` (mm) | Centro Geométrico (mm) |
|---|---:|---:|---|---|---|---|---|
| `01_placa-inferior_LIGERA_escotilla.stl` | 16,496 | 824,884 B | `[-43.473, +43.473]` | `[-3.500, +8.100]` *(placa `0.60..5.10`)* | `[-69.000, +45.000]` *(escotilla `Z < -40`)* | `86.946 × 11.600 × 114.000` | `(0.000, 2.300, -12.000)` |
| `04_piso-superior_deck_V6_ABS.stl` | 13,344 | 667,284 B | `[-80.480, +77.462]` | `[0.000, +8.000]` *(superficie `3.00`, postes `8.00`)* | `[-91.043, +100.097]` | `157.942 × 8.000 × 191.140` | `(-1.509, 4.000, 4.527)` |
| `arm-a_pata-motor.stl` | 2,212 | 110,684 B | `[+19.500, +75.548]` | `[+5.100, +23.100]` | `[+15.508, +75.548]` | `56.048 × 18.000 × 60.040` | `(47.524, 14.100, 45.528)` |
| `arm-b_pata-motor.stl` | 2,226 | 111,384 B | `[-75.548, -19.500]` | `[+5.100, +23.100]` | `[+15.508, +75.548]` | `56.048 × 18.000 × 60.040` | `(-47.524, 14.100, 45.528)` |
| `columna_V_malla_H36m.stl` | 1,930 | 96,584 B | `[-8.000, +21.247]` | `[0.000, +36.000]` | `[-4.250, +4.250]` | `29.247 × 36.000 × 8.500` | `(6.624, 18.000, 0.000)` |

### B. Anclajes Verificados y Transformaciones Aplicadas en el Ensamblaje

1. **`01_placa-inferior_LIGERA_escotilla.stl` (`×1`, `lowerChassisGroup`):**
   - **Transformación:** `position = (0, 0, 0)`, `rotation.y = Math.PI` (`180°`).
   - **Justificación:** La rotación de `180°` lleva la escotilla trasera desde `Z = -69` hacia `Z = +69`, alineándola exactamente debajo de la baquelita de MOSFETs (confirmado en las fotos traseras y laterales reales). Sus 8 orificios M3 de anclaje quedan en `(±24.20, ±24.20)` y `(±35.60, ±35.60)`.
2. **`arm-a_pata-motor.stl` (`×2`, diagonal A) y `arm-b_pata-motor.stl` (`×2`, diagonal B):**
   - Apoyan directamente sobre la cara superior plana de la placa inferior en **`Y = 5.10 mm`** hasta **`Y = 23.10 mm`**, con orificios alineados exactamente en `(±24.20, ±24.20)` y `(±35.60, ±35.60)` (`r = 2.10 mm` / `Ø 4.20 mm`).
   - **Transformaciones exactas y sentidos de giro reales (vistos desde `+Y`):**
     - `M4` Trasero Derecho (`+X, +Z`): `arm-a_pata-motor.stl`, `rotY = 0` → giro **CW** (`rotSign = -1`).
     - `M1` Delantero Izquierdo (`-X, -Z`): `arm-a_pata-motor.stl`, `rotY = Math.PI` → giro **CW** (`rotSign = -1`).
     - `M3` Trasero Izquierdo (`-X, +Z`): `arm-b_pata-motor.stl`, `rotY = 0` → giro **CCW** (`rotSign = +1`).
     - `M2` Delantero Derecho (`+X, -Z`): `arm-b_pata-motor.stl`, `rotY = Math.PI` → giro **CCW** (`rotSign = +1`).
   - En los 4 orificios externos `(±35.60, ±35.60)` se añadieron tornillos Phillips plateados superiores, tuercas hexagonales bajo la placa y espárragos roscados inferiores hasta `Y = -12.0 mm` como las 4 patas/topes de apoyo reales.
3. **`columna_V_malla_H36m.stl` (`×4`, `columnsGroup`):**
   - Geometría nativa: orificio inferior en `(0, 0, 0)` (con avellanado en `Y = 4.0`), vértice interior de la V en `(21.25, 18.00, 0)` y orificio superior en `(11.00, 36.00, 0)`.
   - **Transformaciones:** Apoyadas en **`Y = 23.10 mm`** sobre los brazos, orientando `+X` local hacia el centro `(0, 0)` (silueta en `> <`):
     - `M4 (+X, +Z)`: `pos = (+24.20, 23.10, +24.20)`, `rotY = +135°` (`3π/4`) → tope en `(+16.42, 59.10, +16.42)`.
     - `M3 (-X, +Z)`: `pos = (-24.20, 23.10, +24.20)`, `rotY = +45°` (`π/4`) → tope en `(-16.42, 59.10, +16.42)`.
     - `M1 (-X, -Z)`: `pos = (-24.20, 23.10, -24.20)`, `rotY = -45°` (`-π/4`) → tope en `(-16.42, 59.10, -16.42)`.
     - `M2 (+X, -Z)`: `pos = (+24.20, 23.10, -24.20)`, `rotY = -135°` (`-3π/4`) → tope en `(+16.42, 59.10, -16.42)`.
   - **Holguras verificadas:** Coincidencia con los 4 orificios del piso superior `(±16.50, ±16.50)` a `0.08 mm` y separación libre de `12.34 mm` entre rodillas de columnas opuestas.
4. **`04_piso-superior_deck_V6_ABS.stl` (`×1`, `upperDeckGroup`):**
   - **Transformación:** `position = (0, 59.10, 0)`, `rotation = (0, 0, 0)`.
   - Sus 4 cunas quedan alineadas exactamente con las alas reales:
     - Ala `-Z` (ESP32): hueco interno `X[-13.8, +13.8]`, `Z[-82.7, -27.9]`.
     - Ala `+Z` (Baquelita MOSFET): 4 postes de soporte `Y_local = 8.0` en `(±12.80, 26.40)` y `(±12.80, 89.80)`.
     - Ala `-X` (MT3608): hueco largo `X[-77.0, -40.2]`, `Z[-8.3, +8.3]`.
     - Ala `+X` (MPU-6050): hueco `X[+45.0, +65.6]`, `Z[-7.8, +7.8]`.

---

## 2. Fotos Reales de Referencia Visual (`C:\Dev\Control Dron\Tramos\3ro\fotos y videos reales\`)

Se inspeccionaron directamente las fotografías reales del prototipo físico para validar ubicación, quiralidad, tornillería, polaridades y código de colores:

| Grupo de Vistas | Archivos Inspeccionados | Validaciones Visuales Aplicadas al Modelo 3D |
|---|---|---|
| **Vistas superiores cenitales** | `WhatsApp Image 2026-11-20 at 3.10.01 AM.jpeg`, `3.10.01 AM (1).jpeg`, `3.10.16 AM (6).jpeg`, `3.10.17 AM.jpeg`, `3.10.18 AM.jpeg` | Distribución en cruz de los 4 módulos sobre el deck V6; portabaterías vacío con resorte hacia el MT3608 y contacto dorado hacia el MPU-6050; 4 tornillos Phillips centrales; silueta bi-pala de hélices negras con franjas blancas nítidas cerca de las puntas. |
| **Vistas frontales del ESP32** | `WhatsApp Image 2026-11-20 at 3.10.18 AM (2).jpeg`, `3.10.18 AM (4).jpeg`, `3.10.18 AM (5).jpeg`, `3.10.18 AM (6).jpeg`, `3.10.18 AM (7).jpeg` | ESP32-WROOM-32D boca arriba con blindaje RF plateado hacia el centro del dron, puerto Micro-USB y botones `EN`/`BOOT` hacia el borde exterior, pines atravesando hacia abajo por las ranuras del deck. |
| **Vistas traseras de MOSFETs y escotilla** | `WhatsApp Image 2026-11-20 at 3.10.17 AM (4).jpeg`, `3.10.17 AM (5).jpeg`, `3.10.17 AM (7).jpeg`, `3.10.17 AM (8).jpeg` | Baquelita ocre sobre los 4 postes con 2 arandelas metálicas verdosas en las esquinas del lado del MT3608; fila de 4 IRFZ44N (cuerpo negro mirando al lado `-X`, pestaña perforada hacia `+X`), 4 diodos flyback y puentes cortos rojos/negros; confirmación de la escotilla de la placa inferior centrada debajo del ala MOSFET y los 4 pernos-patas bajo los brazos. |
| **Vistas laterales del MT3608 y columnas** | `WhatsApp Image 2026-11-20 at 3.10.19 AM.jpeg`, `3.10.19 AM (2).jpeg`, `3.10.19 AM (3).jpeg`, `3.10.19 AM (4).jpeg`, `3.10.19 AM (5).jpeg`, `3.10.19 AM (6).jpeg` | PCB azul MT3608 con inductor `220` hacia el interior, potenciómetro azul y tornillo dorado hacia el exterior con brida negra transversal; paleta real de cables naranja/gris oscuro en `VIN`/`VOUT`, rojo/negro de potencia y blanco/café/gris hacia motores, optimizada a un arnés limpio pegado al chasis. |
| **Vistas del MPU-6050, columnas V y motores** | `WhatsApp Image 2026-11-20 at 3.10.01 AM (2).jpeg`, `3.10.16 AM.jpeg`, `3.10.16 AM (3).jpeg`, `3.10.16 AM (4).jpeg`, `3.10.16 AM (5).jpeg`, `3.10.18 AM (8).jpeg` | PCB azul MPU-6050 con chip QFN central y peine horizontal de 8 pines apuntando hacia `-Z` (hacia el ESP32); perfil de columnas V en `> <`; forma de las carcasas cilíndricas de motor con torreta brushed interior sobre la punta de cada brazo y brida plástica en el cuello. |

---

## 3. Estructura de Archivos en `presentacion-3d/` y Verificación Offline

### A. Inventario Completo (19 archivos, 100% autocontenidos)

```text
presentacion-3d/
├── ABRIR-ANIMACION-3D.bat                          (399 B)
├── index.html                                      (3,913 B)
├── servir.js                                       (2,439 B)
├── assets/
│   └── stl/
│       ├── 01_placa-inferior_LIGERA_escotilla.stl  (824,884 B)
│       ├── 04_piso-superior_deck_V6_ABS.stl        (667,284 B)
│       ├── arm-a_pata-motor.stl                    (110,684 B)
│       ├── arm-b_pata-motor.stl                    (111,384 B)
│       └── columna_V_malla_H36m.stl                (96,584 B)
├── css/
│   └── styles.css                                  (7,664 B)
├── js/
│   ├── camera-presets.js                           (1,520 B)
│   ├── config.js                                   (3,404 B)
│   ├── drone-frame.js                              (11,280 B)
│   ├── electronics.js                              (15,920 B)
│   ├── main.js                                     (10,143 B)
│   ├── materials.js                                (13,634 B)
│   ├── panels-slot.js                              (403 B)
│   └── wiring.js                                   (8,819 B)
└── vendor/
    └── three/
        ├── OrbitControls.js                        (29,868 B)
        ├── STLLoader.js                            (10,029 B)
        └── three.module.js                         (1,272,972 B)
```

- **Integridad de fuentes:** Ningún `.stl`, foto o video en `C:\Dev\Control Dron\Tramos\3ro\`, ni archivo alguno de los Tramos 1 y 2 fue modificado.
- **Dependencias externas:** Cero CDN o fuentes web externas. Three.js v0.160.0 y todas las texturas Canvas (`ESP32-WROOM-32D`, baquelita ocre perforada, `MT3608`, `MPU-6050`, batería `INR18650`, micro-grano ABS) se generan y cargan localmente.
- **Preparación modular para Pedido 3.1:** `js/panels-slot.js` y el contenedor `#panels-slot` en `index.html` quedan conectados a la API del visor (`goToPreset`, `setPropMode`, `setExplode`, `setBatteryVisible`) para montar futuras pestañas sin modificar el motor 3D.

### B. Verificación Funcional y de Arranque Offline

1. **Servidor y lanzador:** `servir.js` sirve el directorio raíz en `http://127.0.0.1:3030` con tipos MIME completos (`.html`, `.css`, `.js`, `.stl`, etc.) y control de `EADDRINUSE`. `ABRIR-ANIMACION-3D.bat` valida Node.js en `PATH`, abre el navegador en `http://localhost:3030` y ejecuta `node servir.js`.
2. **Pruebas ejecutadas en navegador contra `http://localhost:3030` (después de las últimas ediciones):**
   - **Carga de red y consola:** `18/18` peticiones HTTP `200` (HTML, CSS, 8 módulos JS propios, 3 módulos locales de Three.js y los 5 `.stl` reales) y **`0` errores de consola**.
   - **Escena sobre `#FFFFFF`:** Fondo blanco puro sin grillas ni horizontes, iluminación de estudio (`HemisphereLight` + luz clave con sombras suaves de las 2 palas de hélice sobre `ShadowMaterial` de opacidad `0.09` + luz de relleno + `rim light`).
   - **Controles interactivos validados:**
     - Movimiento libre `360°` con amortiguación (`OrbitControls`) y 7 vistas de cámara con transición animada de `900 ms` (`General`, `Superior`, `Perfil`, `ESP32`, `MOSFETs`, `MT3608`, `MPU-6050`).
     - Selector de hélices (`OFF` / `Ralentí` / `Vuelo`) con sentidos reales `CW/CCW`.
     - Despiece vertical `0% → 100%` (slider y botón `Abrir/Cerrar`) con actualización dinámica del arnés de cables de motor a lo largo de las columnas V y brazos.
     - Toggle de batería 18650 (`Visible / Oculta`) para inspeccionar el portabaterías vacío con resorte plateado y terminal dorado.
     - Auto-giro (`ON / OFF`) y Modo Limpio (botón o tecla `H`) ocultando toda la interfaz sobre fondo blanco puro.
