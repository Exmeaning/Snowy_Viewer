/**
 * 引擎 score 字段的展示解码：引擎按 target 把主目标值打包进 u64
 * （`(主值 << 32) | live_score`；MySekai/战力/技能为普通整型）。
 * 页面展示前必须按目标解出对应单位，否则会把打包值直接显示出来。
 */

/** 取打包值的高 32 位主值。 */
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
    /** 活动目标的搜索目标（score/power/bonus）。 */
    target?: string;
    /** 最强模式目标（power/skill）。 */
    strongestTarget?: "power" | "skill";
    /** 引擎返回的目标值（可能为打包值）。 */
    targetValue: number;
    /** 活动点数（引擎单独给出时为 true）。 */
    eventPoint?: number;
}

/** 按模式与目标把引擎返回的主值解码为页面展示单位。
 *  event score → PT；event power → 综合力；event bonus → 加成率整数；
 *  challenge → 挑战分数；custom → PT；strongest skill → 实效率；
 *  weakest → 综合力；mysekai → 烤森 Pt。 */
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
