/**
 * Score control calculator — core logic.
 *
 * Deck-building code source: sekai-calculator (https://github.com/pjsek-ai/sekai-calculator)
 * Some algorithm optimizations are adapted from: https://github.com/NeuraXmy/sekai-deck-recommend-cpp.
 *
 * Formula:
 *   Event PT = int(scaled_score × event_rate / 100) × boost_multiplier
 *
 * Where:
 *   score_bonus   = floor(score / 20000)
 *   base          = floor( (100 + score_bonus) × (100 + event_bonus) × rate / 10⁴ )
 *   val           = floor(scaled_score × event_rate / 100)
 *   Event PT      = val × BOOST_BONUS_DICT[boost]
 */

import { getBoostRate, FIRE_OPTIONS } from "@/lib/deck-comparator/calculator";

// ======================== Utility functions ========================

// ======================== Forward calculation ========================

/**
 * Calculate event PT from score and bonus values.
 * @param score       - In-game score (0 ~ 2840000)
 * @param eventBonus  - Deck event bonus percentage (0 ~ 435)
 * @param eventRate   - Song PT rate from music meta
 * @param boost       - Boost energy count (0 ~ 10)
 */
export function calc(
    score: number,
    eventBonus: number,
    eventRate: number,
    boost: number,
): number {
    const scoreBonus = Math.floor(score / 20000);
    // 整数一步取整：floor((100+scoreBonus)×(100+eventBonus)×rate / 10⁴)。
    // 此前的两步浮点链（先 truncate 再乘）在部分格子会因二进制浮点表示
    // 少 1×boost 倍 PT，与整数真值不符。
    const base = Math.floor((100 + scoreBonus) * (100 + eventBonus) * eventRate / 10000);
    return base * getBoostRate(boost);
}

// ======================== Reverse search ========================

export interface ScoreControlResult {
    /** Deck event bonus (%) */
    eventBonus: number;
    /** Boost energy count */
    boost: number;
    /** Boost energy multiplier */
    boostRate: number;
    /** Lower score bound */
    scoreMin: number;
    /** Upper score bound */
    scoreMax: number;
}

/**
 * Reverse search: given a target event PT, find every matching
 * (eventBonus, boost, scoreMin, scoreMax) combination.
 *
 * @param targetPoint   - Target event PT
 * @param eventRate     - Song PT rate
 * @param maxEventBonus - Maximum event bonus (default 435)
 * @param maxScore      - Maximum allowed score (default 2_840_000)
 */
export function getValidScores(
    targetPoint: number,
    eventRate: number,
    maxEventBonus: number = 435,
    maxScore: number = 2_840_000,
): ScoreControlResult[] {
    const results: ScoreControlResult[] = [];

    for (let eventBonus = 0; eventBonus <= maxEventBonus; eventBonus++) {
        for (const opt of FIRE_OPTIONS) {
            const boost = opt.fires;
            const boostRate = opt.rate;

            // Prune: target PT must be divisible by the boost multiplier.
            if (targetPoint % boostRate !== 0) continue;

            // Binary search for the score range where calc() equals targetPoint.
            // First check whether any valid score exists.
            const _targetVal = targetPoint / boostRate; // val = targetPoint / boostRate

            // Find score_max: the maximum score satisfying calc() == targetPoint.
            let lo = 0;
            let hi = maxScore;
            let scoreMax = -1;

            // Check boundary feasibility first.
            if (calc(0, eventBonus, eventRate, boost) > targetPoint) continue;
            if (calc(maxScore, eventBonus, eventRate, boost) < targetPoint) continue;

            // Find the upper bound: largest score where calc(score) <= targetPoint.
            lo = 0;
            hi = maxScore;
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                const pt = calc(mid, eventBonus, eventRate, boost);
                if (pt <= targetPoint) {
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            // hi is now the largest score where calc(score) <= targetPoint.
            scoreMax = hi;

            // Verify it exactly matches the target.
            if (scoreMax < 0 || calc(scoreMax, eventBonus, eventRate, boost) !== targetPoint) continue;

            // Find the lower bound: smallest score where calc(score) >= targetPoint.
            lo = 0;
            hi = scoreMax;
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                const pt = calc(mid, eventBonus, eventRate, boost);
                if (pt >= targetPoint) {
                    hi = mid - 1;
                } else {
                    lo = mid + 1;
                }
            }
            // lo is now the smallest score where calc(score) >= targetPoint.
            const scoreMin = lo;

            // Verify the lower bound.
            if (calc(scoreMin, eventBonus, eventRate, boost) !== targetPoint) continue;

            results.push({
                eventBonus,
                boost,
                boostRate,
                scoreMin,
                scoreMax,
            });
        }
    }

    return results;
}

// ======================== Smart route planning ========================

export interface SmartRouteStep {
    /** Number of repetitions for this step */
    count: number;
    /** Whether this is an AFK step (scoreMin=0) */
    isAFK: boolean;
    /** PT gained each time */
    pt: number;
    /** Deck event bonus (%) */
    eventBonus: number;
    /** Boost energy count */
    boost: number;
    /** Boost energy multiplier */
    boostRate: number;
    /** Lower score bound */
    scoreMin: number;
    /** Upper score bound */
    scoreMax: number;
}

export interface SmartRoutePlan {
    /** Total PT */
    totalPT: number;
    /** Route steps */
    steps: SmartRouteStep[];
    /** Number of AFK plays */
    afkCount: number;
    /** Number of score-control plays */
    controlledCount: number;
    /** Total play count */
    totalPlays: number;
    /** Whether the route is pure AFK */
    isPureAFK: boolean;
}

/**
 * Find the maximum score that produces targetPT under the given
 * (eventBonus, boost) combination.
 */
function findScoreMaxForPT(
    eventBonus: number,
    eventRate: number,
    boost: number,
    targetPT: number,
    maxScore: number = 2_840_000,
): number {
    let lo = 0;
    let hi = maxScore;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (calc(mid, eventBonus, eventRate, boost) <= targetPT) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    if (hi >= 0 && calc(hi, eventBonus, eventRate, boost) === targetPT) return hi;
    return 0;
}

/**
 * Smart route planning: split the target PT into multiple plays,
 * prioritizing AFK routes.
 *
 * Strategy:
 * 1. Pure AFK: N × AFK PT = target
 * 2. AFK + score control: N × AFK PT + 1 × controlled PT = target
 *
 * @param targetPoint   - Target total event PT
 * @param eventRate     - Song PT rate
 * @param minEventBonus - Minimum event bonus (default 0)
 * @param maxEventBonus - Maximum event bonus (default 435)
 * @param maxScoreLimit - Maximum allowed score (default 3000000)
 * @param maxPlays      - Maximum play count per route (default 10)
 * @param maxRoutes     - Maximum number of routes to return (default 20)
 */
export function planSmartRoutes(
    targetPoint: number,
    eventRate: number,
    minEventBonus: number = 0,
    maxEventBonus: number = 435,
    maxScoreLimit: number = 2_840_000,
    maxPlays: number = 10,
    maxRoutes: number = 20,
    validBonuses?: number[],
): SmartRoutePlan[] {
    const plans: SmartRoutePlan[] = [];
    const planKeys = new Set<string>();

    // Determine the set of bonuses to iterate over.
    let bonusIterator: number[] = [];
    if (validBonuses && validBonuses.length > 0) {
        bonusIterator = validBonuses.filter(b => b >= minEventBonus && b <= maxEventBonus);
    } else {
        for (let b = minEventBonus; b <= maxEventBonus; b++) {
            bonusIterator.push(b);
        }
    }

    // Step 1: collect all possible AFK PT values (score=0), dedupe by PT,
    // and keep the lowest eventBonus for each PT value.
    const afkByPT = new Map<number, { eventBonus: number; boost: number; boostRate: number }>();

    for (const eventBonus of bonusIterator) {
        for (const opt of FIRE_OPTIONS) {
            const pt = calc(0, eventBonus, eventRate, opt.fires);
            if (pt <= 0 || pt > targetPoint) continue;

            const existing = afkByPT.get(pt);
            if (!existing || eventBonus < existing.eventBonus) {
                afkByPT.set(pt, {
                    eventBonus,
                    boost: opt.fires,
                    boostRate: opt.rate,
                });
            }
        }
    }

    const afkOptions = Array.from(afkByPT.entries()).map(([pt, opt]) => ({
        pt,
        ...opt,
    }));

    // Step 2: pure AFK route — N × AFK PT = target.
    for (const afk of afkOptions) {
        if (targetPoint % afk.pt === 0) {
            const n = targetPoint / afk.pt;
            if (n >= 1 && n <= maxPlays) {
                const key = `pure_${afk.pt}`;
                if (!planKeys.has(key)) {
                    planKeys.add(key);
                    const scoreMax = findScoreMaxForPT(afk.eventBonus, eventRate, afk.boost, afk.pt, maxScoreLimit);
                    plans.push({
                        totalPT: targetPoint,
                        steps: [{
                            count: n,
                            isAFK: true,
                            pt: afk.pt,
                            eventBonus: afk.eventBonus,
                            boost: afk.boost,
                            boostRate: afk.boostRate,
                            scoreMin: 0,
                            scoreMax,
                        }],
                        afkCount: n,
                        controlledCount: 0,
                        totalPlays: n,
                        isPureAFK: true,
                    });
                }
            }
        }
    }

    // Step 3: AFK + score-control route — N × AFK PT + 1 × controlled PT = target.
    const remainderCache = new Map<number, ScoreControlResult[]>();
    for (const afk of afkOptions) {
        const maxN = Math.min(Math.floor(targetPoint / afk.pt), maxPlays - 1);
        for (let n = maxN; n >= 1; n--) {
            const remainder = targetPoint - n * afk.pt;
            if (remainder <= 0) continue;

            let controlledRaw = remainderCache.get(remainder);
            if (controlledRaw === undefined) {
                controlledRaw = getValidScores(remainder, eventRate, maxEventBonus, maxScoreLimit);
                remainderCache.set(remainder, controlledRaw);
            }

            // Filter by minEventBonus and validBonuses if present.
            const controlled = controlledRaw.filter(r => {
                if (r.eventBonus < minEventBonus) return false;
                if (validBonuses && validBonuses.length > 0) {
                    // Compare with 1-decimal rounding to handle float precision.
                    const rounded = Math.round(r.eventBonus * 10) / 10;
                    return validBonuses.some(vb => Math.round(vb * 10) / 10 === rounded);
                }
                return true;
            });

            if (controlled.length === 0) continue;

            // Pick the best option: prefer AFK (scoreMin=0), then lower eventBonus.
            let best = controlled[0];
            for (let i = 1; i < controlled.length; i++) {
                const c = controlled[i];
                const cIsAFK = c.scoreMin === 0;
                const bIsAFK = best.scoreMin === 0;
                if ((cIsAFK && !bIsAFK) ||
                    (cIsAFK === bIsAFK && (c.eventBonus < best.eventBonus ||
                        (c.eventBonus === best.eventBonus && c.boost < best.boost)))) {
                    best = c;
                }
            }
            const isLastStepAFK = best.scoreMin === 0;

            const key = `mixed_${afk.pt}_${n}_${remainder}`;
            if (!planKeys.has(key)) {
                planKeys.add(key);
                const afkScoreMax = findScoreMaxForPT(afk.eventBonus, eventRate, afk.boost, afk.pt, maxScoreLimit);

                plans.push({
                    totalPT: targetPoint,
                    steps: [
                        {
                            count: n,
                            isAFK: true,
                            pt: afk.pt,
                            eventBonus: afk.eventBonus,
                            boost: afk.boost,
                            boostRate: afk.boostRate,
                            scoreMin: 0,
                            scoreMax: afkScoreMax,
                        },
                        {
                            count: 1,
                            isAFK: isLastStepAFK,
                            pt: remainder,
                            eventBonus: best.eventBonus,
                            boost: best.boost,
                            boostRate: best.boostRate,
                            scoreMin: best.scoreMin,
                            scoreMax: best.scoreMax,
                        },
                    ],
                    afkCount: n + (isLastStepAFK ? 1 : 0),
                    controlledCount: isLastStepAFK ? 0 : 1,
                    totalPlays: n + 1,
                    isPureAFK: isLastStepAFK,
                });
            }
            break; // For this AFK PT, keep the first valid plan with the largest N.
        }
    }

    // Sort: pure AFK first, fewer controlled plays next, then fewer total plays.
    plans.sort((a, b) => {
        if (a.isPureAFK && !b.isPureAFK) return -1;
        if (!a.isPureAFK && b.isPureAFK) return 1;
        if (a.controlledCount !== b.controlledCount) return a.controlledCount - b.controlledCount;
        return a.totalPlays - b.totalPlays;
    });

    return plans.slice(0, maxRoutes);
}

export { getBoostRate, FIRE_OPTIONS };
