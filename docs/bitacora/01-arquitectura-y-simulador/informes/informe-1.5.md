# INFORME TÉCNICO 1.5 — Firmware Definitivo de Vuelo Real ESP32 con Interfaz Web Local Integrada

**Proyecto:** Control de Vuelo Cuadricóptero UAV (ESP32 + MPU6050 + 4× IRFZ44N)  
**Archivos entregados:**
- Firmware autónomo: [`drone_controller.ino`](file:///C:/Dev/Control%20Dron/firmware-esp32/drone_controller.ino)
- Interfaz táctil móvil (espejo idéntico): [`index.html`](file:///C:/Dev/Control%20Dron/app-control-uav/www/index.html)

---

## 1. Mapa Final de Pines y Etapa de Potencia

### 1.1 Alimentación (Batería Li-Ion 18650 3.7 V + Elevador MT3608)
| Bloque / Nodo | Conexión Física | Voltaje / Función |
| :--- | :--- | :--- |
| **Batería 18650 (`B+`)** | Directo al común positivo de los 4 motores y a `VIN+` del **MT3608** | `3.7 V` nominales (`3.0 V – 4.2 V`) para alta corriente de motores |
| **Elevador MT3608 (`OUT+`)** | Calibrado a `5.07 V` hacia pin **`5V / VIN`** del ESP32 (30 pines) | Alimentación regulada estable para evitar reinicios por caída de tensión (*brownout*) |
| **Masa Común (`B-` / `GND`)** | `B-` batería + `VIN-/OUT-` MT3608 + `Source` de los 4 IRFZ44N + `GND` ESP32 + `GND` MPU6050 | Referencia única de retorno de potencia y señal |

### 1.2 Conexiones de Señal, I2C y Motores (ESP32 30 Pines)
| Subsistema | Pin ESP32 | Destino / Función | Notas de Implementación |
| :--- | :--- | :--- | :--- |
| **Motor 1 (`M1_FL`)** | **GPIO 25** | `Gate` MOSFET IRFZ44N #1 — Delantero Izquierdo (**CW**) | Diodo Flyback en antiparalelo sobre el motor; mezcla: `thr - uPitch + uRoll - uYaw` |
| **Motor 2 (`M2_FR`)** | **GPIO 26** | `Gate` MOSFET IRFZ44N #2 — Delantero Derecho (**CCW**) | Diodo Flyback en antiparalelo sobre el motor; mezcla: `thr - uPitch - uRoll + uYaw` |
| **Motor 3 (`M3_RL`)** | **GPIO 27** | `Gate` MOSFET IRFZ44N #3 — Trasero Izquierdo (**CCW**) | Diodo Flyback en antiparalelo sobre el motor; mezcla: `thr + uPitch + uRoll + uYaw` |
| **Motor 4 (`M4_RR`)** | **GPIO 14** | `Gate` MOSFET IRFZ44N #4 — Trasero Derecho (**CW**) | Diodo Flyback en antiparalelo sobre el motor; mezcla: `thr + uPitch - uRoll - uYaw` |
| **MPU6050 SDA** | **GPIO 21** | Bus I2C Datos (`400 kHz`) | Pull-ups integrados en módulo MPU6050 |
| **MPU6050 SCL** | **GPIO 22** | Bus I2C Reloj (`400 kHz`) | Dirección I2C `0x68` |
| **MPU6050 VCC / GND** | **`3V3`** / **`GND`** | Alimentación lógica I2C | Timeout I2C de `4 ms` para arranque seguro sin bloqueo si no hay sensor |

---

## 2. Uso de Memoria Flash/RAM (`PROGMEM`) y Diseño PWM a 2.5 kHz

> **Nota de verificación:** Por restricción de alcance sin uso de terminal, los tamaños totales del binario enlazado con el stack Wi-Fi/lwIP corresponden a estimaciones arquitectónicas basadas en las estructuras estáticas verificadas en [`drone_controller.ino`](file:///C:/Dev/Control%20Dron/firmware-esp32/drone_controller.ino).

### 2.1 Huella de Memoria con la Web Embebida en `PROGMEM`
- **Flash (`PROGMEM` / `.rodata` en DROM):**
  - La interfaz HTML/CSS/JS completa (`578` líneas autocontenidas sin dependencias ni fuentes externas) reside en `static const char INDEX_HTML[] PROGMEM` (`~16 KB` en Flash), servida en puerto `80` (`http://192.168.4.1`) mediante bloques de `1024 B` con `memcpy_P`.
  - Al emplear únicamente las 4 cabeceras nativas del core ESP32 (`<WiFi.h>`, `<Wire.h>`, `<mbedtls/sha1.h>`, `<mbedtls/base64.h>`), el binario completo se mantiene ampliamente dentro de la partición estándar de aplicación (`1.3 MB`), dejando espacio libre para OTA o futuros ajustes.
- **SRAM Estática (Cero fragmentación de *heap* en vuelo):**
  - El servidor HTTP (`httpSlots[4]`) y el servidor WebSocket RFC6455 (`wsClients[4]`) usan exclusivamente arreglos de tamaño fijo en bytes (`reqLine[64]`, `lineBuf[128]`, `wsKey[48]`, `payload[513]`, `json[280]`, `frame[300]`) sin objetos `String` en el lazo crítico de `100 Hz` ni en la transmisión de `50 Hz`.
  - La página `INDEX_HTML` no ocupa SRAM permanente; solo utiliza un búfer temporal en pila de `1024 B` durante los instantes en que un navegador descarga la página por el puerto `80`.

### 2.2 Optimización PWM (`2500 Hz` / `10 bits`) y Desaturación AirMode
- **Frecuencia `PWM_FREQ = 2500 Hz` y Resolución `10 bits` (`0..1023`):**
  - El MOSFET **IRFZ44N** no es de nivel lógico estricto (su $V_{GS(\text{th})}$ típico está entre `2.0 V` y `4.0 V`, y el ESP32 entrega `3.3 V` en GPIO). Bajar la conmutación de `20 kHz` a **`2.5 kHz`** reduce `8×` las pérdidas de conmutación en la región lineal durante las transiciones de subida/bajada del *Gate*, manteniendo los transistores más fríos y elevando el empuje efectivo.
  - Con `10 bits`, el `100%` del acelerador entrega **`1023`** (ciclo útil completo = `3.3 V` continuos sin cortes en el *Gate* para máxima conductividad $R_{DS(\text{on})}$).
- **Desaturación PID (*AirMode*):**
  - Al calcular `m1..m4` en el lazo de `100 Hz (10 ms)`, si algún motor supera `1023`, el exceso `max(m1..m4) - 1023` se resta por igual a los 4 motores antes de limitar a `[0, 1023]`. Esto preserva el torque diferencial de estabilización aun volando al `100%` de acelerador.
- **Compatibilidad Dual ESP32 Core 2.x y 3.x:**
  - Selección condicional mediante `ESP_ARDUINO_VERSION_MAJOR >= 3` para `ledcAttach`/`ledcWrite` vs `ledcSetup`/`ledcAttachPin`/`ledcWrite`, `WiFiServer::accept()` vs `available()`, y `mbedtls_sha1` vs `mbedtls_sha1_ret`.

---

## 3. Pasos de Verificación Antes de Soltar el Dron

Realizar estas pruebas **en orden estricto** antes de intentar el primer despegue libre:

1. **Verificación de Enlace y Sensor (`Sin Hélices`):**
   - Energizar el dron; verificar que el MT3608 entregue `5.07 V` en `5V/VIN` del ESP32.
   - Conectar el celular a la red Wi-Fi **`UDES_UAV_CONTROL`** (clave `12345678`) y abrir **`http://192.168.4.1`** en el navegador (o abrir la app móvil).
   - Confirmar en la barra superior los indicadores en verde: **`CONECTADO`** y **`MPU6050 OK`**.
   - Pulsar **`⛶ PANTALLA COMPLETA`** y verificar que el botón **`KILL`**, los mandos y las barras `M1 25`..`M4 14` quepan completos en pantalla.

2. **Test Secuencial de Motores y Sentido de Giro (`Sin Hélices` o con cinta en los ejes):**
   - Con el estado en `DISARMED`, pulsar **`TEST MOTORES`**.
   - Verificar que giren secuencialmente al `35%` (`300 ms` cada uno) en el orden exacto:
     1. **`M1 25`** (Delantero Izquierdo) -> sentido **CW** (horario visto desde arriba).
     2. **`M2 26`** (Delantero Derecho) -> sentido **CCW** (antihorario).
     3. **`M3 27`** (Trasero Izquierdo) -> sentido **CCW** (antihorario).
     4. **`M4 14`** (Trasero Derecho) -> sentido **CW** (horario).
   - Si algún motor no gira o está intercambiado, corregir cableado antes de montar hélices.

3. **Calibración del MPU6050 y Prueba en Mano del Sentido de Ejes:**
   - Colocar el dron sobre una superficie nivelada y pulsar **`CALIBRAR 0°`** (confirmar `P: 0.0° R: 0.0°`).
   - **Prueba de signos en pantalla (aún `DISARMED`):**
     - Inclinar el frente del dron hacia **abajo** (nariz abajo): `P:` debe volverse **positivo (`+`)**.
     - Inclinar el lado **derecho** del dron hacia **abajo**: `R:` debe volverse **positivo (`+`)**.
   - **Ajuste en [`drone_controller.ino`](file:///C:/Dev/Control%20Dron/firmware-esp32/drone_controller.ino) si el MPU6050 quedó girado:**
     - Editar las 4 constantes al inicio del archivo (líneas `19–22`):
       - Si al inclinar nariz abajo cambia `R:` en lugar de `P:`, poner `SWAP_PITCH_ROLL = true;`.
       - Si el signo de `P:` está invertido, cambiar `SIGN_PITCH = -1;`.
       - Si el signo de `R:` está invertido, cambiar `SIGN_ROLL = -1;`.
       - Si al girar en mano en sentido horario (`CW`) el PID empuja en contra erróneamente, invertir `SIGN_YAW = -1;`.
   - **Prueba de reacción PID en mano (con hélices montadas y sujetando firmemente el chasis desde abajo):**
     - Asegurar modo **`ESTABILIZADO (MPU)`**, deslizador en **`0%`**, pulsar **`ARMAR`** y subir suavemente a `~20–25%`.
     - Inclinar la nariz hacia abajo: los motores delanteros (`M1 25` y `M2 26`) deben acelerar para levantar la nariz.
     - Inclinar el lado derecho hacia abajo: los motores derechos (`M2 26` y `M4 14`) deben acelerar para nivelar el costado.
     - Probar el botón **`KILL`** y verificar corte instantáneo a `0%` y regreso del deslizador a `0%`.

4. **Prueba de Empuje al 100% y Protecciones:**
   - Sujetando firmemente el dron (o en banco de empuje), probar progresivamente con el deslizador y con el botón **`⚡ 100% MAX`** verificando que las 4 barras (`M1 25`..`M4 14`) alcancen `100%` (`1023`) y que en `ESTABILIZADO` las correcciones de actitud sigan actuando sin saturación.
   - Si el dron tiende a derivar hacia un lado en vuelo estacionario, abrir **`PID / TRIM ▾`** y compensar con **`Trim Pitch`** / **`Trim Roll`** o afinar `Kp`, `Ki`, `Kd` en vivo.
   - Verificar antes del primer vuelo libre que al inclinar el dron más de `55°` (con bajo acelerador en mano en modo `ESTABILIZADO`) salte el corte automático `EMERGENCY_STOP`.
