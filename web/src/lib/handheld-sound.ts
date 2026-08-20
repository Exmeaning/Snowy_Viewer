/**
 * Handheld OS UI sound engine.
 *
 * Every sound is synthesized on the fly with oscillators + gain envelopes, so no
 * audio file is ever downloaded: nothing lands in the bundle and nothing is added
 * to the network waterfall.
 *
 * The whole module is decoration. It must be SSR-safe (no `window` /
 * `AudioContext` touched at module scope) and it must never throw — a broken
 * blip is not allowed to break a page.
 */

export type HandheldSoundName = "cursor" | "confirm" | "back" | "toggle" | "error" | "launch";

export const HANDHELD_SOUND_STORAGE_KEY = "moesekai_handheld_sound";

/**
 * Sound is OFF until the user asks for it. A site that starts making noise on
 * its own is hostile — especially with headphones on, or on a page opened in a
 * background tab — so this is strictly opt-in.
 */
export const DEFAULT_HANDHELD_SOUND_ENABLED = false;

/** Ceiling for the whole engine: these are UI ticks, not music. */
const MASTER_GAIN = 0.5;

/** Fast but not clicky attack; clamped against very short steps below. */
const MAX_ATTACK_SECONDS = 0.006;

/** Exponential ramps cannot reach 0, so decay to an inaudible floor instead. */
const SILENCE_GAIN = 0.0001;

/**
 * Key-repeat and fast cursor sweeps can fire the same sound dozens of times per
 * second, which stacks into a machine-gun buzz. Drop repeats of the same sound
 * inside this window.
 */
const REPEAT_SUPPRESSION_MS = 30;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface ToneStep {
    /** Oscillator shape. `sine`/`triangle` stay soft; `square` only for the dull buzz. */
    readonly type: OscillatorType;
    /** Start frequency in Hz. */
    readonly frequency: number;
    /** When set, the step glides from `frequency` to this value. */
    readonly endFrequency?: number;
    /** Offset from the play call, in ms — used to sequence multi-note sounds. */
    readonly startOffsetMs: number;
    /** Envelope length in ms. Kept short so nothing rings. */
    readonly durationMs: number;
    /** Envelope peak, relative to the master gain. */
    readonly peakGain: number;
}

/**
 * Sound character. All of these are short and dry on purpose: a UI tick that
 * rings is worse than silence.
 */
const HANDHELD_SOUND_RECIPES: Record<HandheldSoundName, readonly ToneStep[]> = {
    // Cursor move: the most frequent sound by far, so it is the quietest and the
    // shortest — a barely-there high blip that reads as "something moved".
    cursor: [{ type: "triangle", frequency: 1180, startOffsetMs: 0, durationMs: 38, peakGain: 0.05 }],
    // Confirm / select: two notes stepping up, the classic "yes, taken" gesture.
    confirm: [
        { type: "triangle", frequency: 880, startOffsetMs: 0, durationMs: 48, peakGain: 0.08 },
        { type: "triangle", frequency: 1320, startOffsetMs: 46, durationMs: 62, peakGain: 0.07 },
    ],
    // Back / cancel: the confirm gesture inverted — a short fall, no second note.
    back: [{ type: "triangle", frequency: 660, endFrequency: 420, startOffsetMs: 0, durationMs: 70, peakGain: 0.07 }],
    // Toggle: one flat mid click. Deliberately neutral so it fits both on and off.
    toggle: [{ type: "sine", frequency: 560, startOffsetMs: 0, durationMs: 45, peakGain: 0.07 }],
    // Error / blocked: low and dull, drooping slightly. Discouraging, never sharp.
    error: [{ type: "square", frequency: 150, endFrequency: 118, startOffsetMs: 0, durationMs: 120, peakGain: 0.04 }],
    // Launch: a rising sweep for entering a page or opening a large surface.
    launch: [{ type: "sine", frequency: 420, endFrequency: 1180, startOffsetMs: 0, durationMs: 120, peakGain: 0.07 }],
};

type AudioContextConstructor = new () => AudioContext;

let audioContext: AudioContext | null = null;
let masterGainNode: GainNode | null = null;

/**
 * Mirror of the persisted preference so `playHandheldSound` does not hit
 * `localStorage` on every cursor move. `null` means "not read yet".
 */
let cachedEnabled: boolean | null = null;

const lastPlayedAtMs = new Map<HandheldSoundName, number>();

function getAudioContextConstructor(): AudioContextConstructor | null {
    if (typeof window === "undefined") return null;
    const legacyWindow = window as Window & { webkitAudioContext?: AudioContextConstructor };
    return window.AudioContext ?? legacyWindow.webkitAudioContext ?? null;
}

/**
 * Create the single shared `AudioContext` lazily, on the first user-initiated
 * play. Never at module load: browsers block contexts created before a gesture,
 * and an eager context leaks an audio thread on every page load.
 */
function ensureAudioContext(): AudioContext | null {
    if (audioContext !== null && audioContext.state !== "closed") {
        return audioContext;
    }

    const AudioContextCtor = getAudioContextConstructor();
    if (AudioContextCtor === null) return null;

    audioContext = new AudioContextCtor();
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = MASTER_GAIN;
    masterGainNode.connect(audioContext.destination);
    return audioContext;
}

/**
 * Checked at play time rather than once at module load, because the user can
 * flip the OS setting while the page is open.
 */
function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function readPersistedEnabled(): boolean {
    if (typeof window === "undefined") return DEFAULT_HANDHELD_SOUND_ENABLED;

    try {
        const stored = window.localStorage.getItem(HANDHELD_SOUND_STORAGE_KEY);
        if (stored === "true") return true;
        if (stored === "false") return false;
    } catch {
        // Private-mode / blocked storage: fall through to the default.
    }
    return DEFAULT_HANDHELD_SOUND_ENABLED;
}

export function isHandheldSoundEnabled(): boolean {
    if (cachedEnabled === null) {
        cachedEnabled = readPersistedEnabled();
    }
    return cachedEnabled;
}

/**
 * Update the preference. Called by the settings layer so the module-level cache
 * stays in sync with the context, and safe to call on its own.
 */
export function setHandheldSoundEnabled(enabled: boolean): void {
    cachedEnabled = enabled;

    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(HANDHELD_SOUND_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
        // Storage is optional; the in-memory cache still holds for this session.
    }
}

function scheduleToneStep(context: AudioContext, destination: GainNode, step: ToneStep, startTime: number): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    const stepStart = startTime + step.startOffsetMs / 1000;
    const stepDuration = step.durationMs / 1000;
    const stepEnd = stepStart + stepDuration;
    const attack = Math.min(MAX_ATTACK_SECONDS, stepDuration / 3);

    oscillator.type = step.type;
    oscillator.frequency.setValueAtTime(step.frequency, stepStart);
    if (step.endFrequency !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(step.endFrequency, 1), stepEnd);
    }

    envelope.gain.setValueAtTime(SILENCE_GAIN, stepStart);
    envelope.gain.linearRampToValueAtTime(step.peakGain, stepStart + attack);
    envelope.gain.exponentialRampToValueAtTime(SILENCE_GAIN, stepEnd);

    oscillator.connect(envelope);
    envelope.connect(destination);

    oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
    };
    oscillator.start(stepStart);
    oscillator.stop(stepEnd + 0.01);
}

export function playHandheldSound(name: HandheldSoundName): void {
    try {
        if (!isHandheldSoundEnabled()) return;
        if (prefersReducedMotion()) return;

        const recipe: readonly ToneStep[] | undefined = HANDHELD_SOUND_RECIPES[name];
        if (recipe === undefined) return;

        const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
        const previousMs = lastPlayedAtMs.get(name);
        if (previousMs !== undefined && nowMs - previousMs < REPEAT_SUPPRESSION_MS) return;
        lastPlayedAtMs.set(name, nowMs);

        const context = ensureAudioContext();
        const destination = masterGainNode;
        if (context === null || destination === null) return;

        // Autoplay policies park the context until a gesture; resuming is cheap
        // and a no-op once it is already running.
        if (context.state === "suspended") {
            void context.resume().catch(() => undefined);
        }

        const startTime = context.currentTime;
        for (const step of recipe) {
            scheduleToneStep(context, destination, step, startTime);
        }
    } catch {
        // Audio is decoration — swallow everything rather than break the page.
    }
}
