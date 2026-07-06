export type BackgroundAnimationBudget = "on" | "off";

export const DEFAULT_BACKGROUND_ANIMATION_BUDGET: BackgroundAnimationBudget = "on";
export const BACKGROUND_ANIMATION_BUDGET_STORAGE_KEY = "background-animation-budget";
export const VALID_BACKGROUND_ANIMATION_BUDGETS: readonly BackgroundAnimationBudget[] = ["on", "off"];

export function normalizeBackgroundAnimationBudget(value: string | null): BackgroundAnimationBudget | null {
    if (value === "off") return "off";
    if (value === "on" || value === "performance" || value === "power-save") return "on";
    return null;
}
