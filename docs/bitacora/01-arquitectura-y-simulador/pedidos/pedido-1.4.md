# PEDIDO 1.4: Corrección Integral de Errores de Simulación, Voz en Celular con Selector de Voces, Física "Sígueme", Protección de Acercamiento Wi-Fi, Aterrizaje Completo y "Modo Bailar"

## Problemas Detectados en Video de Pruebas a Resolver de Raíz
1. **Audio duplicado e idioma incorrecto en PC:** El PC y el celular hablan al mismo tiempo y el navegador del PC usa una voz en inglés leyendo español.
2. **Botón de micrófono (`🎙️ JARVIS: ESCUCHANDO`) no se activa:** Al abrir por IP (`http://192.168.39.42:8080`), el navegador bloquea `SpeechRecognition` en orígenes HTTP no seguros sin mostrar error, y al APK le falta el permiso nativo `RECORD_AUDIO`.
3. **Cancelación prematura de modos autónomos (`FOLLOW_ME`, `AUTO_TAKEOFF`, `FAILSAFE_LANDING`):** Los paquetes periódicos `{lx:0, ly:0, rx:0, ry:0}` de la App o el clic para mover al piloto en el Canvas disparan por error `CMD_MANUAL` ("Transfiriendo mando manual al piloto").
4. **Vector invertido en `FOLLOW_ME` ("Sígueme"):** Cuando se activa `Sígueme`, el dron se desplaza en dirección opuesta al piloto en lugar de acercarse a él.
5. **RSSI congelado en `-54 dBm` y falta de acercamiento por pérdida de señal:** El panel derecho muestra `-54 dBm` fijos aunque el piloto esté a 19 metros (`-75 dBm`). Cuando el piloto se aleja y el RSSI cae por debajo de `-75 dBm`, el dron debe proteger el enlace acercándose automáticamente hacia el piloto (fuente Wi-Fi).
6. **Reemplazo de "Maniobra Evasiva" por "Modo Bailar":** Eliminar por completo "Maniobra evasiva" y sustituirla por el comando #5 **«Jarvis, modo bailar» / «baila»** (`CMD_DANCE`).
7. **Estado inicial prendido y fallo en "Aterriza Suave" (`CMD_LAND`):** El dron arranca con motores al 44% y a 12 m de altura en vez de apagado, y al darle a `Aterriza Suave` no llega a `0% PWM` ni apaga los motores.

## Cambios Requeridos en el Código

### 1. Control de Voz Exclusivo en Celular, Selector de Voces y Permisos de Micrófono (`simulador-pc/index.html`, `app-control-uav/www/index.html`, `AndroidManifest.xml`)
- **Audio por defecto solo en el Celular:**
  - En `simulador-pc/index.html`, dejar la síntesis de voz (`speechSynthesis`) **SILENCIADA por defecto (` Voz PC: OFF `)** con un botón interruptor por si el usuario desea activarla en el PC, evitando que hable doble junto con el celular.
  - En `app-control-uav/www/index.html`, mantener la voz **ACTIVA por defecto (`🔊 Voz: ON`)**.
- **Selector Desplegable de Voces (`<select id="voiceSelect">`):**
  - Tanto en la App del celular como en el Simulador PC, agregar un selector desplegable que liste las voces disponibles en `window.speechSynthesis.getVoices()`, priorizando y filtrando primero todas las voces en español (`es-CO`, `es-MX`, `es-ES`, `es-US`) para que jamás lea en inglés, y guardando la voz elegida en `localStorage` con un botón **"🔈 Probar Voz"**.
- **Desbloqueo del Micrófono (`🎙️ JARVIS: ESCUCHANDO`):**
  - En `simulador-pc/index.html`: si el usuario abre `http://192.168.x.x:8080/simulador` en el mismo PC, mostrar un botón destacado o redirigir automáticamente a `http://localhost:8080/simulador` (ya que Chrome/Brave solo habilitan `SpeechRecognition` sin HTTPS en `localhost`).
  - Al pulsar `🎙️ JARVIS: ESCUCHANDO`, invocar primero `navigator.mediaDevices.getUserMedia({ audio: true })` para forzar la ventana de permisos del navegador. Si el navegador bloquea el micrófono por estar en HTTP (`not-allowed`), mostrar un aviso claro en el HUD explicando cómo activarlo y mantener la botonera táctica funcionando al 100%.
  - En `app-control-uav/android/app/src/main/AndroidManifest.xml`: añadir `<uses-permission android:name="android.permission.RECORD_AUDIO" />` y `<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />`.

### 2. Corrección de la Máquina de Estados, Inicio Apagado y Aterrizaje Real (`modo-wifi.js`, `simulador-pc/index.html`, `firmware-esp32/drone_controller.ino`)
- **Inicio 100% Apagado (`IDLE_DISARMED`):**
  - Al iniciar el servidor `modo-wifi.js`, el simulador o el ESP32, el estado inicial obligatorio debe ser `IDLE_DISARMED` con `m1 = 0, m2 = 0, m3 = 0, m4 = 0` (`0% PWM`), `altitud = 0.0 m`, `escala zoom = 1.0x`, `pitch = 0°`, `roll = 0°`.
  - Si el dron está en `IDLE_DISARMED`, no puede despegar ni moverse hasta que reciba `CMD_ARM` (*«Jarvis, enciende»*) o `CMD_TAKEOFF` (*«Jarvis, despega»*).
- **Bloqueo contra Cancelación Accidental de Modos Autónomos:**
  - En `modo-wifi.js` y `simulador-pc/index.html`, **NUNCA** cambiar a `MANUAL_FLIGHT` por recibir tramas periódicas de telemetría `{lx:0, ly:0, rx:0, ry:0}` ni por hacer clic en el Canvas 2D para mover al Piloto.
  - Únicamente pasar a `MANUAL_FLIGHT` cuando el usuario envíe explícitamente el comando `CMD_MANUAL` (*«Jarvis, control manual»*) o cuando mueva físicamente los joysticks superando una zona muerta real (`Math.hypot(lx, ly) > 0.28` o `Math.abs(rx) > 0.28`), e **ignorar** entradas de joysticks menores mientras ejecuta `ARMING_SEQ`, `AUTO_TAKEOFF`, `FOLLOW_ME`, `PATROL_360`, `DANCE_MODE` o `FAILSAFE_LANDING`.
- **Aterrizaje Completo y Corte Total de Motores (`CMD_LAND`):**
  - Al activar `6. Aterriza Suave` (`CMD_LAND`), el estado pasa a `FAILSAFE_LANDING`, reduce progresivamente el PWM y la altitud simulada desde el valor actual hasta `0.0 m` en ~2.5 segundos y, al tocar tierra, pasa automáticamente a `IDLE_DISARMED` dejando los **4 motores en `0 PWM (0%)`** y respondiendo: *"Aterrizaje completado. Motores apagados."*

### 3. Corrección Vectorial del Modo «Sígueme» (`FOLLOW_ME`) y Protección de Acercamiento por Señal Wi-Fi (`RSSI`)
- **Persecución Exacta hacia el Piloto (Sin invertir ejes):**
  - Corregir la cinemática en `modo-wifi.js` y `simulador-pc/index.html`: si el dron está en `(droneX, droneY)` y el piloto en `(pilotX, pilotY)`, calcular `dx = pilotX - droneX` y `dy = pilotY - droneY`, y distancia `d = Math.hypot(dx, dy)`.
  - En modo `FOLLOW_ME`, si `d > 2.0 m`, el vector de velocidad `(vx, vy)` del dron debe apuntar **directamente hacia `(pilotX, pilotY)`** (acercándose suavemente al piloto hasta clavarse en el anillo verde de `2.0 m` / `-55 dBm`), orientando el ángulo `Yaw` hacia el piloto e inclinando `Pitch/Roll` en la dirección correcta del movimiento. Si `d < 1.2 m`, se separa suavemente hasta `2.0 m`.
- **Unificación del RSSI Real y Protección Automática por Pérdida de Señal:**
  - El campo `rssi` global (incluyendo la barra derecha `POTENCIA DE ENLACE RSSI`) debe calcularse siempre en función de la distancia real Dron-Piloto: `rssi = Math.round(-49 - 20 * Math.log10(Math.max(0.5, d)))`.
  - **Protección Activa de Cobertura Wi-Fi:** Si el dron está en el aire (`MANUAL_FLIGHT`, `AUTO_TAKEOFF`, `PATROL_360`, `DANCE_MODE`) y el piloto se aleja haciendo que la señal caiga a `RSSI <= -75 dBm` (`d >= 10 m`), activar automáticamente la protección de enlace (`AUTO_RETURN_WIFI` / `FOLLOW_ME`): JARVIS anuncia *"Alerta de cobertura Wi-Fi. Acercando aeronave hacia la señal del piloto"* y mueve automáticamente el dron hacia las coordenadas del piloto hasta recuperar señal segura (`-55 dBm`, `2.0 m`).

### 4. Reemplazo de «Maniobra Evasiva» por «Modo Bailar» (`CMD_DANCE`)
- Eliminar `CMD_EVADE` ("Maniobra evasiva") del diccionario de voz, de los 7 botones rápidos, de `modo-wifi.js` y de `drone_controller.ino`.
- Crear en el botón #5: **`5. 🕺 Modo Bailar`** (`CMD_DANCE`), activado por voz al decir **«Jarvis, modo bailar»**, **«Jarvis, baila»** o **«modo fiesta»**:
  - Respuesta de voz de JARVIS: *"Activando protocolo de baile acrobático en posición segura."*
  - Acción física y visual (`DANCE_MODE`): Si estaba apagado o en tierra, asciende automáticamente a altitud de baile y ejecuta una coreografía rítmica continua en el sitio combinando oscilaciones sinusoidales de alabeo (`Roll = ±18°`), cabeceo (`Pitch = ±14°`), giros rítmicos en `Yaw`, destello coordinado en las barras PWM de los 4 motores (`M1..M4`) y pulsos de escala/altitud sin desplazarse lejos del piloto, hasta que se le ordene otra acción.

### 5. Informe Técnico Actualizado (`C:\Dev\Control Dron\Tramos\1ro\Informes\informe-1.4.md`)
- Documentar la corrección de los 7 hallazgos experimentales del video de pruebas, la nueva máquina de estados con `DANCE_MODE` y retorno automático por umbral RSSI, la arquitectura de selección de voz en el cliente móvil y la actualización del firmware ESP32.