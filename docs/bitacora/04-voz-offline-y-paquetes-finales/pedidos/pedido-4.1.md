# PEDIDO 4.1: Asistente de Voz "Firulais" 100% Offline (Vosk + TTS Masculino + 2 Canciones con Baile Sincronizado + Protecciones de Vuelo y Apagado)

## Contexto y Alcance
Evolucionar el APK Android ya compilado en `C:\Dev\Control Dron\app-control-uav\` (basado en Capacitor + Vosk offline) manteniendo intacta la comunicación Wi-Fi local con el ESP32 (`http://192.168.4.1`, red `UDES_MOTORES_TEST`, firmware actual `prueba_motores_voz.ino`, sin giroscopio).
**NO modificar el firmware del ESP32.** Toda la lógica de voz, respuesta hablada, reproducción musical, coreografías PWM sincronizadas (vía `/set?m1=..&m2=..&m3=..&m4=..` y `/stop`) y capas de seguridad residen en el APK Android.

### Archivos a Trabajar
1. Audios fuente ya ubicados por el usuario en:
   - `C:\Dev\Control Dron\Tramos\4to\Canciones\WhatsApp Audio 2026-11-20 at 7.03.11 AM.mpeg` (14 s — canción para **"Firulais, sacamos cinco"**)
   - `C:\Dev\Control Dron\Tramos\4to\Canciones\WhatsApp Audio 2026-11-20 at 7.03.35 AM.mpeg` (22 s — canción *"Me vale mondá"* para **"Firulais, qué te vale"**)
2. `C:\Dev\Control Dron\app-control-uav\android\app\src\main\assets\audio\` (copia limpia de ambas canciones para reproducción nativa offline).
3. `C:\Dev\Control Dron\app-control-uav\android\app\src\main\java\...\VoskVoicePlugin.java` (ampliar con TTS masculino nativo Android + reproductor `MediaPlayer` nativo sincronizable + verificación de vocabulario Vosk para "Firulais").
4. `C:\Dev\Control Dron\app-control-uav\www\index.html` (y `app.js` / `styles.css` si la interfaz actual los separa; revisar primero el estado real de `app-control-uav\www\`).
5. `C:\Dev\Control Dron\compilar-apk.ps1` (compilar el nuevo `C:\Dev\Control Dron\app-control-uav\www\uav-control.apk` sin re-empaquetar un `.apk` viejo dentro de `assets/public`).
6. `C:\Dev\Control Dron\Tramos\4to\Informe\informe-4.1.md` (documentación técnica completa).

---

## Cambios Requeridos

### 1. Empaquetado Offline de las Dos Canciones y Audio Nativo (`MediaPlayer` + `TextToSpeech` Masculino)
- Copiar los dos archivos `.mpeg` desde `C:\Dev\Control Dron\Tramos\4to\Canciones\` hacia `C:\Dev\Control Dron\app-control-uav\android\app\src\main\assets\audio\` con nombres limpios:
  - `WhatsApp Audio 2026-11-20 at 7.03.11 AM.mpeg` -> `assets/audio/sacamos_cinco.mpeg`
  - `WhatsApp Audio 2026-11-20 at 7.03.35 AM.mpeg` -> `assets/audio/que_te_vale.mpeg`
- Ampliar el plugin nativo `VoskVoicePlugin.java` (o añadir métodos en el mismo plugin registrado en `MainActivity.java`) con:
  1. **Síntesis de Voz Masculina Offline (`speak({ text })`):**
     - Inicializar `android.speech.tts.TextToSpeech` con idioma español (`new Locale("es", "CO")`, fallback `es-ES` / `es-MX`).
     - Buscar entre `tts.getVoices()` una voz en español de género masculino si existe en el dispositivo (por nombre de voz masculino o características de locale `es`) y aplicar tono grave masculino (`setPitch(0.78f)`, `setSpeechRate(1.02f)`).
     - Emitir eventos `ttsStart` y `ttsEnd` (usando `UtteranceProgressListener`) para que el sistema **silencie/pause el procesamiento de comandos de Vosk mientras Firulais habla**, evitando que el micrófono se escuche a sí mismo.
  2. **Reproductor Nativo de Canciones (`playSong({ songId })`, `stopSong()`, `getSongProgress()`):**
     - Usar `android.media.MediaPlayer` cargando el `AssetFileDescriptor` desde `assets/audio/sacamos_cinco.mpeg` o `assets/audio/que_te_vale.mpeg` (garantiza reproducción 100% offline y compatibilidad nativa con el contenedor `.mpeg` de WhatsApp en Android).
     - Al terminar la canción (`OnCompletionListener`), liberar limpiamente el `MediaPlayer` y emitir el evento `songEnded` hacia JavaScript.
     - Permitir consultar la posición exacta en milisegundos (`getCurrentPosition()`, `getDuration()`) para mantener el baile de los 4 motores sincronizado con el audio.

### 2. Reconocimiento Offline de "Firulais" sin Falsos Positivos (Verificación de Vocabulario Vosk)
- **Verificación obligatoria antes de programar la gramática:**
  - Inspeccionar `app-control-uav\android\app\src\main\assets\vosk-model-es\graph\words.txt` (si existe) para comprobar si la palabra `"firulais"` está en el vocabulario del modelo `vosk-model-small-es-0.42`.
  - Si `"firulais"` **NO** está en `words.txt`, NO encerrar el `Recognizer` en una gramática cerrada que contenga `"firulais"` (porque Vosk la descartaría como `[unk]`). En su lugar, usar el reconocedor en modo español general (`new Recognizer(model, 16000.0f)`) para obtener transcripción fonética real de lo que dice el usuario.
- **Regla estricta de Wake Word (`Firulais`):**
  - **NINGÚN comando se ejecuta** si la frase reconocida no comienza con el activador **"Firulais"** (o alguno de sus alias fonéticos cercanos calibrados).
  - Normalizar texto (minúsculas, sin tildes ni signos) y aceptar alias fonéticos de Vosk para "Firulais" al principio de la frase: `firulais`, `firulay`, `firulays`, `firu lais`, `firo lais`, `filu lais`, `pirulais`, `ferulais`, `virulais`, `firulas`, `fiero lais`, `firo lay`, más cualquier alias extra que el usuario guarde desde la pantalla.
  - Agregar en la tarjeta de voz un botón compacto **"🧪 Calibrar 'Firulais'"**: el usuario toca el botón, dice *"Firulais"* una vez, la app captura el texto exacto que transcribió Vosk y lo agrega automáticamente a la lista de alias válidos guardados en `localStorage` (mostrando la lista editable).

### 3. Repertorio de Comandos de Voz y Capas de Seguridad para Apagado
Implementar una máquina de estados clara en JavaScript (`IDLE`, `RUNNING`, `FLIGHT_MODE`, `AWAITING_OFF_CONFIRM`, `LANDING`, `DANCING`):

1. **Parámetro configurable de despegue con helio (`Umbral de despegue %`):**
   - Añadir en pantalla un control visible y persistente en `localStorage`: **`🎈 Umbral de despegue (Helio): [ 55% ]`** (rango editable `10%` a `95%`, por defecto `55%`).
   - El usuario ajustará este número en cuanto haga la prueba real con los globos de helio para indicar a partir de qué porcentaje el dron despega.

2. **Comando `Firulais, enciende`** (alias tras Firulais: `enciende`, `prende`, `arranca`):
   - Enciende los 4 motores al porcentaje del selector de encendido (`/set?m1=P&m2=P&m3=P&m4=P`).
   - Respuesta TTS masculina: *"Motores encendidos al P por ciento."*

3. **Comando `Firulais, estás volando`** (alias tras Firulais: `estas volando`, `modo vuelo`, `en vuelo`):
   - Activa la bandera `modoVuelo = true` y muestra un badge destacado **`✈️ MODO VUELO ACTIVO (Apagado bloqueado)`** en el HUD.
   - Respuesta TTS masculina: *"Entendido, modo vuelo activado. Apagado directo bloqueado, solo aterrizaje suave disponible."*

4. **Comando `Firulais, aterriza`** (alias tras Firulais: `aterriza`, `aterrizar`, `baja suave`):
   - Único comando de apagado permitido en `MODO VUELO` (y usable en cualquier momento si los motores están girando y no está bailando).
   - Ejecuta una **rampa suave no bloqueante** desde el promedio PWM actual hasta `0%` en ~3.5 segundos (enviando pasos suaves cada 150 ms por `/set?m1=..` y al llegar a `0%` enviando `/stop`), desactiva `modoVuelo = false` y actualiza sliders en tiempo real.
   - Respuesta TTS masculina al iniciar: *"Iniciando aterrizaje suave."* y al llegar a 0%: *"Aterrizaje completado, motores apagados."*

5. **Protecciones del comando `Firulais, apaga` / `Firulais, para`** (alias tras Firulais: `apaga`, `apagate`, `para`, `detener`, `apagar`):
   - **Caso A — En Baile (`DANCING`):** Ignorado por completo (ningún comando de voz interrumpe el baile).
   - **Caso B — Protección de Vuelo Activa:** Se dispara si **`velocidadActual >= umbralDespegueHelio`** **O** si **`modoVuelo === true`** (`"Firulais, estás volando"`):
     - **NO apaga los motores** ni inicia confirmación.
     - Respuesta TTS masculina exacta: **"Estoy volando, te paso el control manual"**
     - Muestra alerta visual en pantalla y enfoca/resalta la sección de sliders manuales (y el botón/estado de `Firulais, aterriza`).
   - **Caso C — En Tierra / Debajo del Umbral (`velocidadActual < umbralDespegueHelio` y `modoVuelo === false`):**
     - **NO apaga de inmediato.** Entra en estado `AWAITING_OFF_CONFIRM` durante **7 segundos** y muestra un aviso visual parpadeante.
     - Respuesta TTS masculina: **"¿Estás seguro?"**
     - Solo si dentro de esos 7 segundos el usuario dice **`Firulais, estoy seguro, apágate`** (alias tras Firulais: `estoy seguro apagate`, `estoy seguro apaga`, `si estoy seguro apagate`, `seguro apagate`), entonces envía `/stop`, pone todos los sliders en `0%` y responde: **"Confirmado. Motores apagados."**
     - Si pasan los 7 segundos sin confirmación, vuelve al estado anterior sin apagar nada y registra *"Apagado cancelado por falta de confirmación"*.

### 4. Comandos de Baile Sincronizado con Música y Bloqueo de Interrupción
Agregar controles ajustables en una tarjeta **"🕺 Configuración de Baile"** (guardados en `localStorage`):
- **Potencia base de baile (`danceBasePct`, ej. 45% por defecto, o la potencia actual si ya está volando por encima).**
- **Amplitud / intensidad del baile (`danceAmpPct`, ej. 20% por defecto, rango 5%–35%).**
- **Piso mínimo de seguridad en baile (`danceMinPct`, ej. 15% por defecto)** para que en los bajoncitos bruscos los motores nunca se apaguen del todo si está sostenido con helio.

Enviar tramas `/set?m1=..&m2=..&m3=..&m4=..` sincronizadas al `currentPositionMs` real de `MediaPlayer` cada ~90 ms (evitando solapar peticiones HTTP si una sigue pendiente):

1. **Comando `Firulais, sacamos cinco`** (alias tras Firulais: `sacamos cinco`, `sacamos 5`, `saco cinco`, `cinco`):
   - Entra en estado `DANCING`, inicia `sacamos_cinco.mpeg` (14.0 s) y ejecuta la coreografía alegre de celebración:
     - **0.0 s – 2.5 s (Fanfarria de entrada de trompetas):** 3 golpes ascendentes sincronizados en los 4 motores (`base + 40% amp` -> pausa corta -> `base + 70% amp` -> pausa corta -> `base + 100% amp`).
     - **2.5 s – 12.6 s (Ritmo salsa/tropical ~136 BPM, cambios cada ~220 ms y acentos cada ~440 ms):**
       - Compases 1–2 (2.5–5.5 s): Balanceo lateral rápido izquierda (`M1,M3` altos / `M2,M4` bajos) alternando con derecha (`M2,M4` altos / `M1,M3` bajos).
       - Compases 3–4 (5.5–8.5 s): Balanceo frontal/trasero (`M1,M2` vs `M3,M4`) con pequeños pulsos de empuje en los golpes de trompeta.
       - Compases 5–6 (8.5–12.6 s): Paso cruzado/diagonal (`M1,M4` vs `M2,M3`) alternado con balanceo lateral veloz celebrando el ritmo.
     - **12.6 s – 14.0 s (Cierre triunfal):** Doble golpe final de los 4 motores y estabilización suave en la potencia previa al baile (o `base`).

2. **Comando `Firulais, qué te vale`** (alias tras Firulais: `que te vale`, `te vale`, `vale monda`, `que vale`):
   - Entra en estado `DANCING`, inicia `que_te_vale.mpeg` (22.0 s) y ejecuta la coreografía con **bajoncitos bruscos** exactamente como pidió el usuario:
     - **0.0 s – 5.2 s (*"Me vale mondá, me vale mondá"*):** Balanceo marcado izquierda/derecha y adelante/atrás siguiendo el rasgueo rítmico (~480 ms por golpe).
     - **5.2 s – 11.4 s (*"¡Aaaah, ah, ah, ah, ah!"* — descenso a tono grave):** Secuencia de **bajoncitos bruscos hacia abajo** (pulsos secos tipo diente de sierra/escalón): cada ~600 ms cae de golpe los 4 motores a `max(danceMinPct, base - amp * 1.45)` durante ~200 ms y recupera rápido a `min(100, base + amp * 0.45)` durante ~180 ms con ligero cabeceo, acentuando cada bajada grave de la voz para que el movimiento brusco hacia abajo sea muy visible.
     - **11.4 s – 15.6 s (Segundo *"Me vale mondá, me vale mondá"*):** Recuperación con balanceo enérgico lateral y diagonal.
     - **15.6 s – 21.8 s (Segundo *"¡Aaaah, ah, ah, ah, ah!"* — remate grave final):** Segunda ráfaga de bajoncitos bruscos rítmicos en escalera descendente hasta cerrar la canción, estabilizando suavemente al terminar.

3. **Bloqueo Estricto Durante el Baile (`DANCING`):**
   - Mientras cualquiera de las dos canciones está sonando:
     - **Todos los comandos de voz quedan ignorados** (no responde a `Firulais apaga`, `Firulais para`, ni a ningún otro comando).
     - Si el usuario intenta tocar o mover **cualquier control manual** (sliders, botones de porcentaje, rutinas o botón de detener), interceptar la interacción y mostrar un **diálogo modal en pantalla**:
       - Título: **`🕺 Baile en curso`**
       - Mensaje: **`¿Seguro que quieres deshabilitar el baile?`**
       - Botones: **`SÍ, deshabilitar`** y **`NO, seguir bailando`**
     - Si pulsa **SÍ**: detiene la música (`stopSong()`), detiene el bucle de coreografía, sale del estado `DANCING` y devuelve el control manual al usuario (manteniendo la potencia segura anterior si estaba por encima del umbral de despegue, o aplicando `0%` solo si el usuario tocó el botón rojo de emergencia).
     - Si pulsa **NO**: cierra el modal y el baile continúa sin interrupción.
   - Al terminar la canción de forma natural (`songEnded`), sale de `DANCING`, devuelve suavemente los motores a la potencia previa al baile (o `0%` si estaba detenido antes de bailar) y reactiva la escucha normal de Firulais.

### 5. Botones Rápidos de Prueba en Pantalla (Respaldo) y Compilación
- Mantener la interfaz oscura limpia del banco de pruebas de 4 motores (M1 GPIO 25, M2 GPIO 26, M3 GPIO 27, M4 GPIO 14, control maestro y botón rojo `⛔ APAGAR TODO`), añadiendo:
  - Indicadores claros del estado actual (`LISTO`, `MODO VUELO`, `ESPERANDO CONFIRMACIÓN`, `ATERRIZANDO`, `BAILANDO`) y visor en tiempo real de lo que transcribe Vosk.
  - Mini botonera de prueba rápida (opcional/plegable) para probar TTS, los dos bailes y la protección de vuelo incluso en ambiente ruidoso.
- Ejecutar `C:\Dev\Control Dron\compilar-apk.ps1` (limpiando primero cualquier `uav-control.apk` previo en `www/`) hasta obtener `BUILD SUCCESSFUL` con el nuevo APK en `C:\Dev\Control Dron\app-control-uav\www\uav-control.apk`.

### 6. Informe Técnico (`C:\Dev\Control Dron\Tramos\4to\Informe\informe-4.1.md`)
- Documentar el diseño completo del Tramo 4:
  1. Arquitectura de voz offline (Vosk + verificación de vocabulario para `"Firulais"` + TTS masculino nativo Android + `MediaPlayer` nativo).
  2. Diagrama y tabla de la máquina de estados con las 3 capas de protección de apagado (umbral helio, modo `"Firulais, estás volando"` + aterrizaje suave, y confirmación `"¿Estás seguro?"` -> `"Firulais, estoy seguro, apágate"`).
  3. Tabla cronológica de la coreografía PWM para `"Firulais, sacamos cinco"` (14 s) y `"Firulais, qué te vale"` (22 s, detallando los pulsos de bajoncitos bruscos).
  4. Guía paso a paso de instalación en el celular y calibración con globos de helio.