package edu.udes.uav.gcs;

import android.Manifest;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

@CapacitorPlugin(
    name = "VoskVoice",
    permissions = {
        @Permission(
            alias = "microphone",
            strings = { Manifest.permission.RECORD_AUDIO }
        )
    }
)
public class VoskVoicePlugin extends Plugin {

    private static final String TAG = "VoskVoicePlugin";
    private static final String ASSET_MODEL_DIR = "vosk-model-es";
    private static final float SAMPLE_RATE = 16000.0f;
    private static final float TTS_PITCH = 0.78f;
    private static final float TTS_SPEECH_RATE = 1.02f;
    private static final long TTS_WATCHDOG_MS = 15000L;
    private static final long TTS_COOLDOWN_MS = 600L;
    private static final long SONG_COOLDOWN_MS = 1200L;
    private static final long MANUAL_STOP_COOLDOWN_MS = 600L;

    private static final String[] DEFAULT_PHRASES = {
        "dron",
        "enciende",
        "apaga",
        "para",
        "aterriza",
        "volando"
    };

    private static final Map<String, String> SONG_ASSET_MAP = new HashMap<>();
    static {
        SONG_ASSET_MAP.put("sacamos_cinco", "audio/sacamos_cinco.mpeg");
        SONG_ASSET_MAP.put("que_te_vale", "audio/que_te_vale.mpeg");
    }

    private static final String[] MALE_VOICE_HINTS = {
        "male", "hombre", "masculino", "esd", "esf", "eed", "eef",
        "jorge", "diego", "carlos", "enrique", "juan", "pablo",
        "miguel", "antonio", "raul", "mateo", "andres", "luis"
    };

    private static final String[] FEMALE_VOICE_HINTS = {
        "female", "mujer", "femenin", "sfb", "eea", "eec", "esc",
        "monica", "paulina", "sofia", "lucia", "elena", "carmen",
        "maria", "laura", "valeria", "isabel", "ana"
    };

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Object serviceLock = new Object();
    private final Object ttsLock = new Object();
    private final Object mediaLock = new Object();
    private final Object resumeLock = new Object();

    private final AtomicBoolean isAudioBusy = new AtomicBoolean(false);
    private final AtomicLong audioSessionSeq = new AtomicLong(0L);
    private Runnable pendingResumeRunnable = null;

    private volatile Model model = null;
    private volatile boolean isModelLoading = false;
    private SpeechService speechService = null;
    private Recognizer activeRecognizer = null;

    private TextToSpeech tts = null;
    private volatile boolean ttsReady = false;
    private volatile boolean ttsInitializing = false;
    private volatile boolean ttsSpeaking = false;
    private volatile String selectedTtsVoiceName = "";
    private volatile String selectedTtsLocale = "es-CO";
    private volatile String activeUtteranceId = null;
    private volatile boolean activeUtteranceStartEmitted = false;
    private String pendingSpeakText = null;
    private long utteranceCounter = 0L;
    private Runnable ttsWatchdogRunnable = null;

    private MediaPlayer mediaPlayer = null;
    private volatile boolean isSongPlaying = false;
    private volatile String activeSongId = null;
    private volatile int activeSongDurationMs = 0;

    private volatile long muteUntilMs = 0L;

    @Override
    public void load() {
        super.load();
        initTtsInternal();
    }

    @PluginMethod
    public void initModel(PluginCall call) {
        initTtsInternal();

        if (model != null) {
            JSObject ready = buildReadyPayload();
            emitEvent("voiceState", ready);
            call.resolve(ready);
            return;
        }

        if (isModelLoading) {
            JSObject loading = buildStatePayload("loading", null);
            emitEvent("voiceState", loading);
            call.resolve(loading);
            return;
        }

        isModelLoading = true;
        emitEvent("voiceState", buildStatePayload("loading", null));

        executor.execute(() -> {
            try {
                File modelDir = new File(getContext().getFilesDir(), ASSET_MODEL_DIR);
                if (!isModelValid(modelDir)) {
                    deleteRecursively(modelDir);
                    if (!modelDir.mkdirs() && !modelDir.isDirectory()) {
                        throw new IOException("No se pudo crear el directorio del modelo: " + modelDir.getAbsolutePath());
                    }
                    String[] rootEntries = getContext().getAssets().list(ASSET_MODEL_DIR);
                    if (rootEntries == null || rootEntries.length == 0) {
                        throw new IOException("La carpeta assets/" + ASSET_MODEL_DIR + " no existe o está vacía en el APK");
                    }
                    copyAssetFolder(getContext().getAssets(), ASSET_MODEL_DIR, modelDir);
                }

                if (!isModelValid(modelDir)) {
                    throw new IOException("Modelo Vosk incompleto tras copiar assets/" + ASSET_MODEL_DIR);
                }

                Model loadedModel = new Model(modelDir.getAbsolutePath());
                this.model = loadedModel;
                this.isModelLoading = false;

                JSObject ready = buildReadyPayload();
                emitEvent("voiceState", ready);
                call.resolve(ready);
            } catch (Exception e) {
                this.isModelLoading = false;
                String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                Log.e(TAG, "Error al inicializar el modelo Vosk", e);
                emitEvent("voiceState", buildStatePayload("error", msg));
                call.reject("Error al inicializar Vosk: " + msg, e);
            }
        });
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermsCallback");
            return;
        }
        beginListening(call);
    }

    @PermissionCallback
    private void microphonePermsCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            beginListening(call);
        } else {
            String msg = "Permiso de micrófono (RECORD_AUDIO) denegado";
            emitEvent("voiceState", buildStatePayload("error", msg));
            call.reject(msg);
        }
    }

    private void beginListening(PluginCall call) {
        if (model == null) {
            String state = isModelLoading ? "loading" : "error";
            String msg = isModelLoading
                ? "El modelo Vosk aún se está cargando"
                : "El modelo Vosk no está inicializado";
            emitEvent("voiceState", buildStatePayload(state, msg));
            call.reject(msg);
            return;
        }

        // Modo español abierto por defecto para capturar "dron", alias calibrados y frases completas.
        boolean useGrammar = Boolean.TRUE.equals(call.getBoolean("useGrammar", false));
        String grammarJson = useGrammar ? buildGrammarJson(call.getArray("phrases")) : null;
        stopSpeechServiceInternal();

        synchronized (serviceLock) {
            try {
                Recognizer recognizer = useGrammar
                    ? new Recognizer(model, SAMPLE_RATE, grammarJson)
                    : new Recognizer(model, SAMPLE_RATE);
                SpeechService service = new SpeechService(recognizer, SAMPLE_RATE);

                activeRecognizer = recognizer;
                speechService = service;

                service.startListening(createRecognitionListener());
                syncSpeechPauseLocked();

                emitEvent("voiceState", buildStatePayload("listening", null));

                JSObject result = new JSObject();
                result.put("listening", true);
                result.put("mode", useGrammar ? "grammar" : "open-spanish");
                if (grammarJson != null) {
                    result.put("grammar", grammarJson);
                }
                call.resolve(result);
            } catch (Exception e) {
                stopSpeechServiceLocked();
                String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                Log.e(TAG, "Error al iniciar reconocimiento Vosk", e);
                emitEvent("voiceState", buildStatePayload("error", msg));
                call.reject("No se pudo iniciar la escucha Vosk: " + msg, e);
            }
        }
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        stopSpeechServiceInternal();
        emitEvent("voiceState", buildStatePayload("stopped", null));

        JSObject result = new JSObject();
        result.put("listening", false);
        call.resolve(result);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String rawText = call.getString("text", "");
        String text = rawText != null ? rawText.trim() : "";
        if (text.isEmpty()) {
            JSObject emptyRes = new JSObject();
            emptyRes.put("spoken", false);
            emptyRes.put("reason", "empty_text");
            call.resolve(emptyRes);
            return;
        }

        synchronized (ttsLock) {
            if (!ttsReady || tts == null) {
                pendingSpeakText = text;
                initTtsInternal();
                JSObject notReady = new JSObject();
                notReady.put("spoken", false);
                notReady.put("reason", "tts_initializing");
                call.resolve(notReady);
                return;
            }
        }

        JSObject res = speakInternal(text);
        call.resolve(res);
    }

    @PluginMethod
    public void stopSpeak(PluginCall call) {
        stopTtsInternal(true);
        JSObject res = new JSObject();
        res.put("stopped", true);
        call.resolve(res);
    }

    @PluginMethod
    public void getVoiceInfo(PluginCall call) {
        JSObject info = new JSObject();
        info.put("ttsReady", ttsReady);
        info.put("ttsSpeaking", ttsSpeaking);
        info.put("voiceName", selectedTtsVoiceName);
        info.put("locale", selectedTtsLocale);
        info.put("songPlaying", isSongPlaying);
        info.put("songId", activeSongId != null ? activeSongId : "");
        call.resolve(info);
    }

    @PluginMethod
    public void playSong(PluginCall call) {
        String rawId = call.getString("songId", "");
        String songId = rawId != null ? rawId.trim() : "";
        String assetPath = SONG_ASSET_MAP.get(songId);
        if (assetPath == null) {
            call.reject("Canción desconocida: " + songId);
            return;
        }

        synchronized (mediaLock) {
            if (isSongPlaying || mediaPlayer != null) {
                JSObject ignored = new JSObject();
                ignored.put("playing", false);
                ignored.put("ignored", true);
                ignored.put("reason", "already_playing");
                ignored.put("songId", activeSongId != null ? activeSongId : "");
                call.resolve(ignored);
                return;
            }
        }

        pauseSpeechImmediate();
        stopTtsInternal(true, false);

        synchronized (mediaLock) {
            if (isSongPlaying || mediaPlayer != null) {
                JSObject ignored = new JSObject();
                ignored.put("playing", false);
                ignored.put("ignored", true);
                ignored.put("reason", "already_playing");
                ignored.put("songId", activeSongId != null ? activeSongId : "");
                call.resolve(ignored);
                return;
            }

            MediaPlayer mp = new MediaPlayer();
            try {
                mp.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                );

                boolean loadedFromFd = false;
                try (AssetFileDescriptor afd = getContext().getAssets().openFd(assetPath)) {
                    mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    loadedFromFd = true;
                } catch (IOException fdErr) {
                    Log.w(TAG, "openFd no disponible para " + assetPath + ", extrayendo a cacheDir", fdErr);
                }

                if (!loadedFromFd) {
                    File cachedAudio = extractAssetToCache(assetPath, songId + ".mpeg");
                    mp.setDataSource(cachedAudio.getAbsolutePath());
                }

                mp.setLooping(false);
                mp.setVolume(1.0f, 1.0f);
                mp.prepare();
                mp.setLooping(false);

                final int durationMs = Math.max(0, mp.getDuration());
                mediaPlayer = mp;
                activeSongId = songId;
                activeSongDurationMs = durationMs;
                isSongPlaying = true;
                isAudioBusy.set(true);
                audioSessionSeq.incrementAndGet();
                syncSpeechPause();

                mp.setOnCompletionListener(completedMp -> {
                    boolean cleared = false;
                    synchronized (mediaLock) {
                        if (mediaPlayer == completedMp) {
                            releaseMediaPlayerLocked(completedMp);
                            mediaPlayer = null;
                            isSongPlaying = false;
                            activeSongId = null;
                            activeSongDurationMs = 0;
                            cleared = true;
                        }
                    }
                    if (cleared) {
                        JSObject ev = new JSObject();
                        ev.put("songId", songId);
                        ev.put("completed", true);
                        ev.put("durationMs", durationMs);
                        scheduleResumeAfterCooldown(SONG_COOLDOWN_MS, () -> emitEvent("songEnded", ev));
                    }
                });

                mp.setOnErrorListener((errMp, what, extra) -> {
                    boolean cleared = false;
                    synchronized (mediaLock) {
                        if (mediaPlayer == errMp) {
                            releaseMediaPlayerLocked(errMp);
                            mediaPlayer = null;
                            isSongPlaying = false;
                            activeSongId = null;
                            activeSongDurationMs = 0;
                            cleared = true;
                        }
                    }
                    if (cleared) {
                        JSObject ev = new JSObject();
                        ev.put("songId", songId);
                        ev.put("completed", false);
                        ev.put("error", "MediaPlayer error " + what + "/" + extra);
                        scheduleResumeAfterCooldown(SONG_COOLDOWN_MS, () -> emitEvent("songEnded", ev));
                    }
                    return true;
                });

                mp.start();

                JSObject res = new JSObject();
                res.put("playing", true);
                res.put("songId", songId);
                res.put("durationMs", durationMs);
                call.resolve(res);
            } catch (Exception e) {
                releaseMediaPlayerLocked(mp);
                mediaPlayer = null;
                isSongPlaying = false;
                activeSongId = null;
                activeSongDurationMs = 0;
                scheduleResumeAfterCooldown(MANUAL_STOP_COOLDOWN_MS, null);
                String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                Log.e(TAG, "Error reproduciendo canción " + songId, e);
                call.reject("No se pudo reproducir " + songId + ": " + msg, e);
            }
        }
    }

    @PluginMethod
    public void stopSong(PluginCall call) {
        stopMediaInternal();
        JSObject res = new JSObject();
        res.put("stopped", true);
        call.resolve(res);
    }

    @PluginMethod
    public void getSongProgress(PluginCall call) {
        boolean playing = false;
        String songId = "";
        int posMs = 0;
        int durMs = 0;

        synchronized (mediaLock) {
            if (isSongPlaying && mediaPlayer != null) {
                try {
                    posMs = Math.max(0, mediaPlayer.getCurrentPosition());
                    durMs = Math.max(activeSongDurationMs, mediaPlayer.getDuration());
                    songId = activeSongId != null ? activeSongId : "";
                    playing = true;
                } catch (IllegalStateException e) {
                    playing = false;
                }
            }
        }

        JSObject res = new JSObject();
        res.put("playing", playing);
        res.put("songId", songId);
        res.put("currentPositionMs", posMs);
        res.put("durationMs", durMs);
        call.resolve(res);
    }

    @Override
    protected void handleOnDestroy() {
        audioSessionSeq.incrementAndGet();
        stopMediaInternal();
        shutdownTtsInternal();
        stopSpeechServiceInternal();
        mainHandler.removeCallbacksAndMessages(null);
        if (model != null) {
            try {
                model.close();
            } catch (Exception e) {
                Log.w(TAG, "Error cerrando Model de Vosk", e);
            }
            model = null;
        }
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void initTtsInternal() {
        synchronized (ttsLock) {
            if (ttsReady || ttsInitializing) {
                return;
            }
            ttsInitializing = true;
        }

        mainHandler.post(() -> {
            try {
                TextToSpeech instance = new TextToSpeech(getContext().getApplicationContext(), status -> {
                    if (status == TextToSpeech.SUCCESS) {
                        configureTtsOnReady();
                    } else {
                        synchronized (ttsLock) {
                            ttsReady = false;
                            ttsInitializing = false;
                            pendingSpeakText = null;
                        }
                        Log.w(TAG, "TextToSpeech falló al inicializar: status=" + status);
                    }
                });
                synchronized (ttsLock) {
                    if (tts != null) {
                        try {
                            tts.stop();
                            tts.shutdown();
                        } catch (Exception ignored) {}
                    }
                    tts = instance;
                }
            } catch (Exception e) {
                synchronized (ttsLock) {
                    ttsReady = false;
                    ttsInitializing = false;
                    pendingSpeakText = null;
                }
                Log.e(TAG, "Excepción inicializando TextToSpeech", e);
            }
        });
    }

    private void configureTtsOnReady() {
        String textToSpeakAfterInit = null;
        synchronized (ttsLock) {
            if (tts == null) {
                ttsReady = false;
                ttsInitializing = false;
                return;
            }

            try {
                Locale[] candidates = {
                    new Locale("es", "CO"),
                    new Locale("es", "MX"),
                    new Locale("es", "US"),
                    new Locale("es", "ES"),
                    new Locale("es")
                };

                Locale chosenLocale = new Locale("es", "CO");
                for (Locale loc : candidates) {
                    int langRes = tts.setLanguage(loc);
                    if (langRes != TextToSpeech.LANG_MISSING_DATA && langRes != TextToSpeech.LANG_NOT_SUPPORTED) {
                        chosenLocale = loc;
                        selectedTtsLocale = loc.toLanguageTag();
                        break;
                    }
                }

                Voice bestMaleVoice = selectBestSpanishMaleVoice(tts, chosenLocale);
                if (bestMaleVoice != null) {
                    tts.setVoice(bestMaleVoice);
                    selectedTtsVoiceName = bestMaleVoice.getName();
                    if (bestMaleVoice.getLocale() != null) {
                        selectedTtsLocale = bestMaleVoice.getLocale().toLanguageTag();
                    }
                } else {
                    Voice currentVoice = tts.getVoice();
                    selectedTtsVoiceName = currentVoice != null ? currentVoice.getName() : "default";
                }

                tts.setPitch(TTS_PITCH);
                tts.setSpeechRate(TTS_SPEECH_RATE);
                tts.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                );

                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        handleTtsStarted(utteranceId);
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        handleTtsFinished(utteranceId, true, null);
                    }

                    @Override
                    public void onError(String utteranceId) {
                        handleTtsFinished(utteranceId, false, "error");
                    }

                    @Override
                    public void onError(String utteranceId, int errorCode) {
                        handleTtsFinished(utteranceId, false, "error_" + errorCode);
                    }

                    @Override
                    public void onStop(String utteranceId, boolean interrupted) {
                        handleTtsFinished(utteranceId, false, interrupted ? "interrupted" : "stopped");
                    }
                });

                ttsReady = true;
                ttsInitializing = false;
                textToSpeakAfterInit = pendingSpeakText;
                pendingSpeakText = null;
                Log.i(TAG, "TTS listo: locale=" + selectedTtsLocale + ", voice=" + selectedTtsVoiceName);
            } catch (Exception e) {
                ttsReady = false;
                ttsInitializing = false;
                pendingSpeakText = null;
                Log.e(TAG, "Error configurando TextToSpeech", e);
            }
        }

        if (textToSpeakAfterInit != null && !textToSpeakAfterInit.isEmpty()) {
            speakInternal(textToSpeakAfterInit);
        }
    }

    private Voice selectBestSpanishMaleVoice(TextToSpeech engine, Locale fallbackLocale) {
        try {
            Set<Voice> voices = engine.getVoices();
            if (voices == null || voices.isEmpty()) {
                return null;
            }
            Voice bestVoice = null;
            int bestScore = Integer.MIN_VALUE;

            for (Voice voice : voices) {
                if (voice == null || voice.getLocale() == null) {
                    continue;
                }
                if (!"es".equalsIgnoreCase(voice.getLocale().getLanguage())) {
                    continue;
                }

                Set<String> features = voice.getFeatures();
                if (features != null && features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) {
                    continue;
                }

                int score = 10;
                if (!voice.isNetworkConnectionRequired()) {
                    score += 50;
                }

                String country = voice.getLocale().getCountry();
                if ("CO".equalsIgnoreCase(country)) {
                    score += 18;
                } else if ("MX".equalsIgnoreCase(country) || "US".equalsIgnoreCase(country) || "ES".equalsIgnoreCase(country)) {
                    score += 10;
                } else if (fallbackLocale != null && fallbackLocale.getCountry().equalsIgnoreCase(country)) {
                    score += 12;
                }

                StringBuilder meta = new StringBuilder();
                if (voice.getName() != null) {
                    meta.append(voice.getName().toLowerCase(Locale.ROOT)).append(' ');
                }
                if (features != null) {
                    for (String feat : features) {
                        if (feat != null) {
                            meta.append(feat.toLowerCase(Locale.ROOT)).append(' ');
                        }
                    }
                }
                String metaStr = meta.toString();

                for (String hint : MALE_VOICE_HINTS) {
                    if (metaStr.contains(hint)) {
                        score += 40;
                        break;
                    }
                }
                for (String hint : FEMALE_VOICE_HINTS) {
                    if (metaStr.contains(hint)) {
                        score -= 30;
                        break;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestVoice = voice;
                }
            }

            return bestVoice;
        } catch (Exception e) {
            Log.w(TAG, "No se pudo consultar voices() de TTS", e);
            return null;
        }
    }

    private JSObject speakInternal(String text) {
        JSObject result = new JSObject();
        String utteranceId;

        if (isSongPlaying) {
            result.put("spoken", false);
            result.put("reason", "song_playing");
            return result;
        }

        audioSessionSeq.incrementAndGet();
        pauseSpeechImmediate();

        synchronized (ttsLock) {
            if (!ttsReady || tts == null) {
                isAudioBusy.set(false);
                syncSpeechPause();
                result.put("spoken", false);
                result.put("reason", "tts_not_ready");
                return result;
            }

            clearTtsWatchdogLocked();
            utteranceId = "dron_" + (++utteranceCounter);
            activeUtteranceId = utteranceId;
            activeUtteranceStartEmitted = false;
            ttsSpeaking = true;
            isAudioBusy.set(true);
            syncSpeechPause();

            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);

            scheduleTtsWatchdogLocked(utteranceId);

            int code = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
            if (code == TextToSpeech.ERROR) {
                clearTtsWatchdogLocked();
                activeUtteranceId = null;
                ttsSpeaking = false;

                JSObject endEv = new JSObject();
                endEv.put("utteranceId", utteranceId);
                endEv.put("ok", false);
                endEv.put("reason", "tts_speak_error");
                scheduleResumeAfterCooldown(TTS_COOLDOWN_MS, () -> emitEvent("ttsEnd", endEv));

                result.put("spoken", false);
                result.put("reason", "tts_speak_error");
                return result;
            }
        }

        result.put("spoken", true);
        result.put("utteranceId", utteranceId);
        result.put("voice", selectedTtsVoiceName);
        result.put("locale", selectedTtsLocale);
        return result;
    }

    private void handleTtsStarted(String utteranceId) {
        boolean shouldEmit = false;
        synchronized (ttsLock) {
            if (activeUtteranceId != null && activeUtteranceId.equals(utteranceId)) {
                ttsSpeaking = true;
                isAudioBusy.set(true);
                if (!activeUtteranceStartEmitted) {
                    activeUtteranceStartEmitted = true;
                    shouldEmit = true;
                }
            }
        }
        syncSpeechPause();
        if (shouldEmit) {
            JSObject ev = new JSObject();
            ev.put("utteranceId", utteranceId);
            emitEvent("ttsStart", ev);
        }
    }

    private void handleTtsFinished(String utteranceId, boolean ok, String reason) {
        boolean shouldEmit = false;
        synchronized (ttsLock) {
            if (activeUtteranceId != null && activeUtteranceId.equals(utteranceId)) {
                clearTtsWatchdogLocked();
                activeUtteranceId = null;
                activeUtteranceStartEmitted = false;
                ttsSpeaking = false;
                shouldEmit = true;
            }
        }
        if (shouldEmit) {
            JSObject ev = new JSObject();
            ev.put("utteranceId", utteranceId);
            ev.put("ok", ok);
            if (reason != null) {
                ev.put("reason", reason);
            }
            if (!isSongPlaying) {
                scheduleResumeAfterCooldown(TTS_COOLDOWN_MS, () -> emitEvent("ttsEnd", ev));
            } else {
                emitEvent("ttsEnd", ev);
            }
        }
    }

    private void scheduleTtsWatchdogLocked(String utteranceId) {
        ttsWatchdogRunnable = () -> handleTtsFinished(utteranceId, false, "watchdog_timeout");
        mainHandler.postDelayed(ttsWatchdogRunnable, TTS_WATCHDOG_MS);
    }

    private void clearTtsWatchdogLocked() {
        if (ttsWatchdogRunnable != null) {
            mainHandler.removeCallbacks(ttsWatchdogRunnable);
            ttsWatchdogRunnable = null;
        }
    }

    private void stopTtsInternal(boolean emitIfActive) {
        stopTtsInternal(emitIfActive, true);
    }

    private void stopTtsInternal(boolean emitIfActive, boolean resumeAfter) {
        String prevId = null;
        synchronized (ttsLock) {
            clearTtsWatchdogLocked();
            pendingSpeakText = null;
            if (tts != null) {
                try {
                    tts.stop();
                } catch (Exception e) {
                    Log.w(TAG, "Error deteniendo TTS", e);
                }
            }
            if (ttsSpeaking && activeUtteranceId != null) {
                prevId = activeUtteranceId;
            }
            activeUtteranceId = null;
            activeUtteranceStartEmitted = false;
            ttsSpeaking = false;
        }
        final String cancelledId = prevId;
        if (resumeAfter && !isSongPlaying) {
            if (emitIfActive && cancelledId != null) {
                JSObject ev = new JSObject();
                ev.put("utteranceId", cancelledId);
                ev.put("ok", false);
                ev.put("reason", "cancelled");
                scheduleResumeAfterCooldown(TTS_COOLDOWN_MS, () -> emitEvent("ttsEnd", ev));
            } else if (cancelledId != null || isAudioBusy.get()) {
                scheduleResumeAfterCooldown(TTS_COOLDOWN_MS, null);
            }
        } else if (emitIfActive && cancelledId != null) {
            JSObject ev = new JSObject();
            ev.put("utteranceId", cancelledId);
            ev.put("ok", false);
            ev.put("reason", "cancelled");
            emitEvent("ttsEnd", ev);
        }
    }

    private void shutdownTtsInternal() {
        synchronized (ttsLock) {
            clearTtsWatchdogLocked();
            pendingSpeakText = null;
            activeUtteranceId = null;
            ttsSpeaking = false;
            ttsReady = false;
            ttsInitializing = false;
            if (tts != null) {
                try {
                    tts.stop();
                    tts.shutdown();
                } catch (Exception e) {
                    Log.w(TAG, "Error cerrando TextToSpeech", e);
                }
                tts = null;
            }
        }
    }

    private void stopMediaInternal() {
        boolean hadMedia = false;
        synchronized (mediaLock) {
            if (mediaPlayer != null || isSongPlaying) {
                hadMedia = true;
            }
            if (mediaPlayer != null) {
                releaseMediaPlayerLocked(mediaPlayer);
                mediaPlayer = null;
            }
            isSongPlaying = false;
            activeSongId = null;
            activeSongDurationMs = 0;
        }
        if (hadMedia) {
            scheduleResumeAfterCooldown(MANUAL_STOP_COOLDOWN_MS, null);
        } else {
            syncSpeechPause();
        }
    }

    private void releaseMediaPlayerLocked(MediaPlayer mp) {
        if (mp == null) {
            return;
        }
        try {
            if (mp.isPlaying()) {
                mp.stop();
            }
        } catch (Exception ignored) {}
        try {
            mp.reset();
        } catch (Exception ignored) {}
        try {
            mp.release();
        } catch (Exception e) {
            Log.w(TAG, "Error liberando MediaPlayer", e);
        }
    }

    private File extractAssetToCache(String assetPath, String fileName) throws IOException {
        File outFile = new File(getContext().getCacheDir(), fileName);
        if (outFile.isFile() && outFile.length() > 0L) {
            return outFile;
        }
        try (InputStream in = getContext().getAssets().open(assetPath);
             OutputStream out = new FileOutputStream(outFile)) {
            byte[] buffer = new byte[8192];
            int len;
            while ((len = in.read(buffer)) != -1) {
                out.write(buffer, 0, len);
            }
            out.flush();
        }
        return outFile;
    }

    private void pauseSpeechImmediate() {
        synchronized (resumeLock) {
            if (pendingResumeRunnable != null) {
                mainHandler.removeCallbacks(pendingResumeRunnable);
                pendingResumeRunnable = null;
            }
        }
        isAudioBusy.set(true);
        syncSpeechPause();
    }

    private void resetRecognizerSafeLocked() {
        if (activeRecognizer != null) {
            try {
                activeRecognizer.reset();
            } catch (Exception e) {
                Log.w(TAG, "Error reseteando Recognizer", e);
            }
        }
    }

    private void scheduleResumeAfterCooldown(long cooldownMs, Runnable onResumed) {
        final long token = audioSessionSeq.incrementAndGet();
        isAudioBusy.set(true);
        synchronized (serviceLock) {
            syncSpeechPauseLocked();
            resetRecognizerSafeLocked();
        }
        muteUntilMs = System.currentTimeMillis() + cooldownMs + 120L;

        Runnable task = new Runnable() {
            @Override
            public void run() {
                synchronized (resumeLock) {
                    if (pendingResumeRunnable == this) {
                        pendingResumeRunnable = null;
                    }
                }
                if (token != audioSessionSeq.get() || ttsSpeaking || isSongPlaying) {
                    return;
                }
                synchronized (serviceLock) {
                    if (token != audioSessionSeq.get() || ttsSpeaking || isSongPlaying) {
                        return;
                    }
                    resetRecognizerSafeLocked();
                    isAudioBusy.set(false);
                    syncSpeechPauseLocked();
                }
                if (onResumed != null) {
                    onResumed.run();
                }
            }
        };

        synchronized (resumeLock) {
            if (pendingResumeRunnable != null) {
                mainHandler.removeCallbacks(pendingResumeRunnable);
            }
            pendingResumeRunnable = task;
        }
        mainHandler.postDelayed(task, cooldownMs);
    }

    private void syncSpeechPause() {
        synchronized (serviceLock) {
            syncSpeechPauseLocked();
        }
    }

    private void syncSpeechPauseLocked() {
        if (speechService != null) {
            try {
                speechService.setPause(isAudioBusy.get() || ttsSpeaking || isSongPlaying);
            } catch (Exception e) {
                Log.w(TAG, "No se pudo cambiar estado de pausa de SpeechService", e);
            }
        }
    }

    private RecognitionListener createRecognitionListener() {
        return new RecognitionListener() {
            @Override
            public void onPartialResult(String hypothesis) {
                emitVoiceResult(hypothesis, "partial", false);
            }

            @Override
            public void onResult(String hypothesis) {
                emitVoiceResult(hypothesis, "text", true);
            }

            @Override
            public void onFinalResult(String hypothesis) {
                emitVoiceResult(hypothesis, "text", true);
            }

            @Override
            public void onError(Exception exception) {
                String msg = exception != null && exception.getMessage() != null
                    ? exception.getMessage()
                    : "Error en SpeechService";
                Log.e(TAG, "Error en reconocimiento Vosk", exception);
                stopSpeechServiceInternal();
                emitEvent("voiceState", buildStatePayload("error", msg));
            }

            @Override
            public void onTimeout() {
                stopSpeechServiceInternal();
                emitEvent("voiceState", buildStatePayload("stopped", "Tiempo de escucha agotado"));
            }
        };
    }

    private void emitVoiceResult(String hypothesis, String jsonKey, boolean isFinal) {
        if (isAudioBusy.get() || ttsSpeaking || isSongPlaying || System.currentTimeMillis() < muteUntilMs) {
            return;
        }
        if (hypothesis == null || hypothesis.trim().isEmpty()) {
            return;
        }
        try {
            JSONObject obj = new JSONObject(hypothesis);
            String raw = obj.optString(jsonKey, "");
            String cleaned = raw.replace("[unk]", "").replaceAll("\\s+", " ").trim();
            if (cleaned.isEmpty()) {
                return;
            }
            JSObject payload = new JSObject();
            payload.put("text", cleaned);
            payload.put("isFinal", isFinal);
            emitEvent("voiceResult", payload);
        } catch (JSONException e) {
            Log.w(TAG, "JSON inválido de Vosk: " + hypothesis, e);
        }
    }

    private void emitEvent(String eventName, JSObject data) {
        if (getBridge() != null) {
            execute(() -> notifyListeners(eventName, data));
        } else {
            notifyListeners(eventName, data);
        }
    }

    private JSObject buildReadyPayload() {
        JSObject ready = buildStatePayload("ready", null);
        ready.put("ttsReady", ttsReady);
        ready.put("ttsVoice", selectedTtsVoiceName);
        ready.put("ttsLocale", selectedTtsLocale);
        return ready;
    }

    private JSObject buildStatePayload(String state, String message) {
        JSObject obj = new JSObject();
        obj.put("state", state);
        if (message != null && !message.isEmpty()) {
            obj.put("message", message);
        }
        return obj;
    }

    private String buildGrammarJson(JSArray phrasesArray) {
        Set<String> uniquePhrases = new LinkedHashSet<>();
        Locale esLocale = new Locale("es", "ES");

        if (phrasesArray != null) {
            try {
                List<Object> rawList = phrasesArray.toList();
                for (Object item : rawList) {
                    if (item == null) {
                        continue;
                    }
                    String normalized = item.toString()
                        .trim()
                        .toLowerCase(esLocale)
                        .replaceAll("\\s+", " ");
                    if (!normalized.isEmpty() && !"[unk]".equals(normalized)) {
                        uniquePhrases.add(normalized);
                    }
                }
            } catch (JSONException e) {
                Log.w(TAG, "No se pudo leer el arreglo phrases; usando gramática por defecto", e);
            }
        }

        if (uniquePhrases.isEmpty()) {
            for (String defPhrase : DEFAULT_PHRASES) {
                uniquePhrases.add(defPhrase);
            }
        }

        JSONArray grammar = new JSONArray();
        for (String phrase : uniquePhrases) {
            grammar.put(phrase);
        }
        grammar.put("[unk]");
        return grammar.toString();
    }

    private void stopSpeechServiceInternal() {
        synchronized (serviceLock) {
            stopSpeechServiceLocked();
        }
    }

    private void stopSpeechServiceLocked() {
        if (speechService != null) {
            try {
                speechService.stop();
            } catch (Exception e) {
                Log.w(TAG, "Error en speechService.stop()", e);
            }
            try {
                speechService.shutdown();
            } catch (Exception e) {
                Log.w(TAG, "Error en speechService.shutdown()", e);
            }
            speechService = null;
        }
        // Liberar Recognizer solo después de detener y apagar SpeechService para evitar fallos JNI.
        if (activeRecognizer != null) {
            try {
                activeRecognizer.close();
            } catch (Exception e) {
                Log.w(TAG, "Error cerrando Recognizer", e);
            }
            activeRecognizer = null;
        }
    }

    private boolean isModelValid(File modelDir) {
        return modelDir.isDirectory()
            && new File(modelDir, "conf/model.conf").isFile()
            && new File(modelDir, "am/final.mdl").isFile()
            && new File(modelDir, "graph").isDirectory()
            && new File(modelDir, "ivector").isDirectory();
    }

    private void copyAssetFolder(AssetManager assets, String assetPath, File destDir) throws IOException {
        String[] entries = assets.list(assetPath);
        if (entries != null && entries.length > 0) {
            if (!destDir.exists() && !destDir.mkdirs()) {
                throw new IOException("No se pudo crear carpeta destino: " + destDir.getAbsolutePath());
            }
            for (String entry : entries) {
                String childAsset = assetPath + "/" + entry;
                File childDest = new File(destDir, entry);
                copyAssetFolder(assets, childAsset, childDest);
            }
        } else {
            try (InputStream in = assets.open(assetPath)) {
                File parent = destDir.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IOException("No se pudo crear carpeta padre: " + parent.getAbsolutePath());
                }
                try (OutputStream out = new FileOutputStream(destDir)) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                    }
                    out.flush();
                }
            } catch (IOException openErr) {
                // Si el nodo en assets es un directorio vacío, assets.open lanza excepción.
                if (entries != null && !destDir.exists() && !destDir.mkdirs()) {
                    throw openErr;
                }
            }
        }
    }

    private void deleteRecursively(File target) {
        if (target == null || !target.exists()) {
            return;
        }
        File[] children = target.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursively(child);
            }
        }
        if (!target.delete()) {
            Log.w(TAG, "No se pudo eliminar: " + target.getAbsolutePath());
        }
    }
}
