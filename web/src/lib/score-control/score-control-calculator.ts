/**
 * 控分计算器 — 核心逻辑
 *
 * 组卡代码来源: sekai-calculator (https://github.com/pjsek-ai/sekai-calculator)
 * 部分算法优化修改于: https://github.com/NeuraXmy/sekai-deck-recommend-cpp  作者: luna茶
 *
 * 公式:
 *   活动PT = int(scaled_score × event_rate / 100) × boost_multiplier
 *
 * 其中:
 *   score_bonus   = floor(score / 20000)
 *   scaled_score  = truncate( (100 + score_bonus) × (100 + event_bonus) / 100 )
 *   val           = floor(scaled_score × event_rate / 100)
 *   活动PT        = val × BOOST_BONUS_DICT[boost]
 */

import { getBoostRate, FIRE_OPTIONS } from "@/lib/deck-comparator/calculator";

// ======================== 工具函数 ========================

/** 截断到两位小数（不四舍五入） */
function truncate(x: number): number {
    return Math.floor(x * 100) / 100;
}

// ======================== 正向计算 ========================

/**
 * 正向计算活动PT
 * @param score       - 游戏内得分 (0 ~ 2840000)
 * @param eventBonus  - 卡组活动加成百分比 (0 ~ 435)
 * @param eventRate   - 歌曲PT系数 (从 music meta 获取)
 * @param boost       - 火罐数量 (0 ~ 10)
 */
export function calc(
    score: number,
    eventBonus: number,
    eventRate: number,
    boost: number,
): number {
    const scoreBonus = Math.floor(score / 20000);
    const scaledScore = truncate(
        (100 + scoreBonus) * (100 + eventBonus) / 100,
    );
    const val = Math.floor(scaledScore * eventRate / 100);
    return val * getBoostRate(boost);
}

// ======================== 反向搜索 ========================

export interface ScoreControlResult {
    /** 卡组活动加成 (%) */
    eventBonus: number;
    /** 火罐数量 */
    boost: number;
    /** 火罐倍率 */
    boostRate: number;
    /** 得分下界 */
    scoreMin: number;
    /** 得分上界 */
    scoreMax: number;
}

/**
 * 反向搜索：给定目标活动PT，找出所有满足条件的 (eventBonus, boost, scoreMin, scoreMax) 组合
 *
 * @param targetPoint   - 目标活动PT
 * @param eventRate     - 歌曲PT系数
 * @param maxEventBonus - 最大活动加成 (默认 415)
 * @param maxScore      - 最大允许得分 (默认 100000)
 */
export function getValidScores(
    targetPoint: number,
    eventRate: number,
    maxEventBonus: number = 415,
    maxScore: number = 3000000,
): ScoreControlResult[] {
    const results: ScoreControlResult[] = [];

    for (let eventBonus = 0; eventBonus <= maxEventBonus; eventBonus++) {
        for (const opt of FIRE_OPTIONS) {
            const boost = opt.fires;
            const boostRate = opt.rate;

            // 剪枝: 目标PT必须能被火罐倍率整除
            if (targetPoint % boostRate !== 0) continue;

            // 二分搜索: 找到 calc() == targetPoint 的分数范围
            // 先检查是否存在任何有效分数
            const targetVal = targetPoint / boostRate; // val = targetPoint / boostRate

            // 查找 score_max: 满足 calc() == targetPoint 的最大分数
            let lo = 0;
            let hi = maxScore;
            let scoreMax = -1;

            // 先检查边界是否有解
            if (calc(0, eventBonus, eventRate, boost) > targetPoint) continue;
            if (calc(maxScore, eventBonus, eventRate, boost) < targetPoint) continue;

            // 找上界: 最大的 score 使得 calc(score) == targetPoint
            // 等价于找最大的 score 使得 calc(score) <= targetPoint
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
            // hi 现在是最大的 score 使得 calc(score) <= targetPoint
            scoreMax = hi;

            // 验证确实等于目标
            if (scoreMax < 0 || calc(scoreMax, eventBonus, eventRate, boost) !== targetPoint) continue;

            // 找下界: 最小的 score 使得 calc(score) == targetPoint
            // 等价于找最小的 score 使得 calc(score) >= targetPoint
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
            // lo 现在是最小的 score 使得 calc(score) >= targetPoint
            const scoreMin = lo;

            // 验证
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

// ======================== 智能路线规划 ========================

export interface SmartRouteStep {
    /** 该步骤重复次数 */
    count: number;
    /** 是否是放置步骤 (scoreMin=0) */
    isAFK: boolean;
    /** 每次获得的PT */
    pt: number;
    /** 卡组活动加成 (%) */
    eventBonus: number;
    /** 火罐数量 */
    boost: number;
    /** 火罐倍率 */
    boostRate: number;
    /** 得分下界 */
    scoreMin: number;
    /** 得分上界 */
    scoreMax: number;
}

export interface SmartRoutePlan {
    /** 总PT */
    totalPT: number;
    /** 路线步骤 */
    steps: SmartRouteStep[];
    /** 放置次数 */
    afkCount: number;
    /** 控分次数 */
    controlledCount: number;
    /** 总游戏次数 */
    totalPlays: number;
    /** 是否纯放置 */
    isPureAFK: boolean;
}

/**
 * 查找给定 (eventBonus, boost) 下，产生 targetPT 的最大得分
 */
function findScoreMaxForPT(
    eventBonus: number,
    eventRate: number,
    boost: number,
    targetPT: number,
    maxScore: number = 3000000,
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
 * 智能路线规划：将目标PT拆分为多次游戏，优先放置路线
 *
 * 策略:
 * 1. 纯放置: N × 放置PT = 目标
 * 2. 放置+控分: N × 放置PT + 1 × 控分PT = 目标
 *
 * @param targetPoint   - 目标总活动PT
 * @param eventRate     - 歌曲PT系数
 * @param minEventBonus - 最小活动加成 (默认 0)
 * @param maxEventBonus - 最大活动加成 (默认 415)
 * @param maxScore      - 最大允许得分 (默认 100000)
 * @param maxPlays      - 单条路线最多游戏次数 (默认 10)
 * @param maxRoutes     - 最多返回路线数 (默认 20)
 */
export function planSmartRoutes(
    targetPoint: number,
    eventRate: number,
    minEventBonus: number = 0,
    maxEventBonus: number = 415,
    maxScoreLimit: number = 3000000,
    maxPlays: number = 10,
    maxRoutes: number = 20,
    validBonuses?: number[],
): SmartRoutePlan[] {
    const plans: SmartRoutePlan[] = [];
    const planKeys = new Set<string>();

    // Determine the set of bonuses to iterate over
    let bonusIterator: number[] = [];
    if (validBonuses && validBonuses.length > 0) {
        bonusIterator = validBonuses.filter(b => b >= minEventBonus && b <= maxEventBonus);
    } else {
        for (let b = minEventBonus; b <= maxEventBonus; b++) {
            bonusIterator.push(b);
        }
    }

    // Step 1: 收集所有可能的放置PT (score=0)，按 PT 值去重，保留最低 eventBonus
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

    // Step 2: 纯放置路线 — N × 放置PT = 目标
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

    // Step 3: 放置+控分路线 — N × 放置PT + 1 × 控分PT = 目标
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

            // Filter by minEventBonus AND validBonuses if present
            const controlled = controlledRaw.filter(r => {
                if (r.eventBonus < minEventBonus) return false;
                if (validBonuses && validBonuses.length > 0) {
                    // Compare with 1-decimal rounding to handle float precision
                    const rounded = Math.round(r.eventBonus * 10) / 10;
                    return validBonuses.some(vb => Math.round(vb * 10) / 10 === rounded);
                }
                return true;
            });

            if (controlled.length === 0) continue;

            // 选最佳方案: 优先放置 (scoreMin=0)，然后低 eventBonus
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
            break; // 对该 afk PT，只取最大 N 找到的第一个有效方案
        }
    }

    // 排序: 纯放置优先 → 控分次数少 → 总场次少
    plans.sort((a, b) => {
        if (a.isPureAFK && !b.isPureAFK) return -1;
        if (!a.isPureAFK && b.isPureAFK) return 1;
        if (a.controlledCount !== b.controlledCount) return a.controlledCount - b.controlledCount;
        return a.totalPlays - b.totalPlays;
    });

    return plans.slice(0, maxRoutes);
}

export { getBoostRate, FIRE_OPTIONS };
