/**
 * Area talk category utilities
 * Mirrors the logic from refer/story_crawler/src/pjsk.py Area_talk_getter.__get_category
 */

export interface IActionSet {
    id: number;
    areaId: number;
    releaseConditionId: number;
    scenarioId?: string;
    actionSetType?: string;
    isNextGrade?: boolean;
    characterIds?: number[];
}

/**
 * Area category type
 * - number: event_id
 * - "grade1": 日常对话（第一学年）
 * - "grade2": 日常对话（第二学年）
 * - "theater": 剧场版
 * - "limited_{areaId}": 限定区域
 * - "aprilfool{year}": 愚人节活动
 */
export type AreaCategory = number | "grade1" | "grade2" | "theater" | string;

/**
 * Get category for an actionSet
 * Returns empty string if no valid category
 */
export function getAreaCategory(action: IActionSet): AreaCategory | "" {
    const cond = String(action.releaseConditionId);
    
    // Event-related talks (releaseConditionId format: 1XXXXX)
    if (action.scenarioId && cond.length === 6 && cond[0] === "1") {
        return parseInt(cond.slice(1, 4), 10) + 1;
    }
    
    // Special case for mzk5
    if (action.id === 2373) return 145;
    
    // April Fool's talks (must check before limited)
    if (action.scenarioId && action.scenarioId.includes("aprilfool")) {
        return action.scenarioId.split("_")[1]; // e.g. "aprilfool2022"
    }
    
    // Limited area talks
    if (action.scenarioId && action.actionSetType === "limited") {
        return `limited_${action.areaId}`;
    }
    
    // Grade 1 (normal, not next grade)
    if (
        action.scenarioId &&
        action.actionSetType === "normal" &&
        action.isNextGrade === false &&
        action.releaseConditionId === 1
    ) {
        return "grade1";
    }
    
    // Grade 2 (normal, next grade)
    if (
        action.scenarioId &&
        action.actionSetType === "normal" &&
        action.isNextGrade === true &&
        action.releaseConditionId === 1
    ) {
        return "grade2";
    }
    
    // Theater talks
    if (action.scenarioId && action.releaseConditionId >= 2000000 && action.releaseConditionId <= 2000036) {
        return "theater";
    }
    
    // No category or op_02area
    return "";
}

/**
 * Convert category to URL parameter
 */
export function categoryToUrlParam(cat: AreaCategory): string {
    if (typeof cat === "number") return `event_${cat}`;
    return cat;
}

/**
 * Parse URL parameter back to category
 */
export function urlParamToCategory(param: string): AreaCategory {
    if (param.startsWith("event_")) return parseInt(param.slice(6), 10);
    return param;
}
