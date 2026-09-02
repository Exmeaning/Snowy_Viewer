/**
 * Display-side decoding of the engine score field: the engine packs the
 * primary target value into the upper 32 bits of a u64
 * (`(primary << 32) | live_score`; MySekai/power/skill are plain ints).
 * The page must decode by target before display, otherwise the packed raw
 * value would be shown directly.
 */

/** Take the high 32 bits of a packed value. */
export function decodeTargetHigh(targetValue: number): number {
    return Math.floor(targetValue / 2 ** 32);
}

export type DeckDisplayMode =
    | "event"
    | "challenge"
    | "custom"
    | "strongest"
    | "weakest"
    | "mysekai";

export interface DeckDisplayInput {
    mode: DeckDisplayMode;
    /** Event search target (score/power/bonus). */
    target?: string;
    /** Strongest mode target (power/skill). */
    strongestTarget?: "power" | "skill";
    /** Raw target value from the engine (possibly packed). */
    targetValue: number;
    /** Event point (present when the engine gives it separately). */
    eventPoint?: number;
}

/** Decode the engine's primary value into the display unit for the mode.
 *  event score → PT; event power → total power; event bonus → bonus %;
 *  challenge → challenge score; custom → PT; strongest skill → effective %;
 *  weakest → total power; mysekai → MySekai PT. */
export function resolveDeckScore(input: DeckDisplayInput): number {
    const { mode, target, strongestTarget, targetValue, eventPoint } = input;
    switch (mode) {
        case "challenge":
        case "custom":
            return eventPoint ?? decodeTargetHigh(targetValue);
        case "mysekai":
            return targetValue;
        case "event": {
            if ((target ?? "score") === "score") {
                return eventPoint ?? decodeTargetHigh(targetValue);
            }
            if (target === "bonus") {
                return decodeTargetHigh(targetValue) / 2;
            }
            return targetValue;
        }
        case "strongest":
            return (strongestTarget ?? "power") === "skill"
                ? targetValue / 10
                : targetValue;
        default:
            return targetValue;
    }
}
