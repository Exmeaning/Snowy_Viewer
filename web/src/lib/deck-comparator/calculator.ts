/**
 * 简易多人模式歌曲 PT 计算器
 */

// ======================== 类型定义 ========================

export interface MusicMeta {
    music_id: number;
    difficulty: string;
    music_time: number;
    base_score: number;
    fever_score: number;
    tap_count: number;
    event_rate: number;
    skill_score_solo: number[];
    /** 多人模式 6 个技能槽权重 [slot0 .. slot4, slot5(Skill6)] */
    skill_score_multi: number[];
    skill_score_auto: number[];
    base_score_auto: number;
}

export interface PlayerConfig {
    /** 综合力 */
    power: number;
    /** 实效（%） */
    effectiveness: number;
}

/** Skill6 触发模式 */
export enum Skill6Mode {
    /** 全队 5 人实效的算术平均 */
    TEAM_AVERAGE = 'team_average',
    /** 综合力最高的玩家对应实效 */
    HIGHEST_POWER = 'highest_power',
}

/** Skill1-5 排列策略 */
export enum Skill15Strategy {
    /** 期望值（所有排列等概率的数学期望） */
    EXPECTED = 'expected',
    /** 最优排列（实效高 ↔ 权重高） */
    BEST = 'best',
    /** 最差排列（实效高 ↔ 权重低） */
    WORST = 'worst',
}

export interface CalculationResult {
    score: number;
    baseScorePart: number;
    skill15Part: number;
    skill6Part: number;
    activeBonus: number;
    totalPower: number;
    skill6Effectiveness: number;
    skill6Mode: Skill6Mode;
    skill15Strategy: Skill15Strategy;
    details: {
        baseRate: number;
        skill15Contribution: number;
        skill6Contribution: number;
        totalRate: number;
        userPower: number;
        allPlayers: PlayerConfig[];
        /** 当权重不全相同时，最优/最差得分参考 */
        scoreBest: number;
        scoreWorst: number;
    };
}

export interface PTResult {
    /** 最终活动PT */
    pt: number;
    /** 基础PT值 (110 + selfScore/17000 + min(13, otherScore/340000)) */
    basePT: number;
    /** 自己的得分 */
    selfScore: number;
    /** 其他4人得分总和 */
    otherScore: number;
    /** 活动歌曲倍率 (event_rate) */
    eventRate: number;
    /** 卡组加成倍率 (1 + deckBonus/100) */
    deckRate: number;
    /** 火罐倍率 */
    boostRate: number;
    /** 火罐数量 */
    fires: number;
    /** 卡组加成百分比 */
    deckBonus: number;
}

// ======================== 火罐倍率 ========================

/** 火罐数量  → 倍率: 0=1x, 1~5=每火5x, 6~10= 27/29/31/33/35 */
export function getBoostRate(fires: number): number {
    if (fires <= 0) return 1;
    if (fires <= 5) return fires * 5;
    // 6→27, 7→29, 8→31, 9→33, 10→35
    const extraRates = [27, 29, 31, 33, 35];
    return extraRates[Math.min(fires - 6, 4)];
}

export const FIRE_OPTIONS = [
    { fires: 0, label: "0🔥", rate: 1 },
    { fires: 1, label: "1🔥", rate: 5 },
    { fires: 2, label: "2🔥", rate: 10 },
    { fires: 3, label: "3🔥", rate: 15 },
    { fires: 4, label: "4🔥", rate: 20 },
    { fires: 5, label: "5🔥", rate: 25 },
    { fires: 6, label: "6🔥", rate: 27 },
    { fires: 7, label: "7🔥", rate: 29 },
    { fires: 8, label: "8🔥", rate: 31 },
    { fires: 9, label: "9🔥", rate: 33 },
    { fires: 10, label: "10🔥", rate: 35 },
];

// ======================== 核心计算器 ========================

export class MultiLivePTCalculator {
    private teammates: PlayerConfig[];
    private _skill6Mode: Skill6Mode;
    private _skill15Strategy: Skill15Strategy;

    constructor(
        defaultPower: number = 200_000,
        defaultEffectiveness: number = 200,
    ) {
        this.teammates = Array.from({ length: 4 }, () => ({
            power: defaultPower,
            effectiveness: defaultEffectiveness,
        }));
        this._skill6Mode = Skill6Mode.TEAM_AVERAGE;
        this._skill15Strategy = Skill15Strategy.EXPECTED;
    }

    // ───────── 队友配置 ─────────

    setTeammate(index: number, power: number, effectiveness: number): void {
        if (index < 0 || index >= 4) throw new RangeError(`index 须为 0-3, 当前: ${index}`);
        this.teammates[index] = { power, effectiveness };
    }

    setAllTeammates(power: number, effectiveness: number): void {
        for (let i = 0; i < 4; i++) this.teammates[i] = { power, effectiveness };
    }

    getTeammates(): readonly PlayerConfig[] {
        return this.teammates;
    }

    // ───────── Skill6 模式 ─────────

    setSkill6Mode(mode: Skill6Mode): void {
        this._skill6Mode = mode;
    }

    get skill6Mode(): Skill6Mode {
        return this._skill6Mode;
    }

    // ───────── Skill1-5 策略 ─────────

    setSkill15Strategy(strategy: Skill15Strategy): void {
        this._skill15Strategy = strategy;
    }

    get skill15Strategy(): Skill15Strategy {
        return this._skill15Strategy;
    }

    // ───────── 计算 ─────────

    calculate(
        userPower: number,
        userEffectiveness: number,
        musicMeta: MusicMeta,
    ): CalculationResult {
        const w = musicMeta.skill_score_multi;
        if (!w || w.length < 6) {
            throw new Error(`skill_score_multi 须含 6 个权重, 当前: ${w?.length ?? 0}`);
        }

        // 全部 5 名玩家（用户 + 4 队友）
        const allPlayers: PlayerConfig[] = [
            { power: userPower, effectiveness: userEffectiveness },
            ...this.teammates.map((t) => ({ ...t })),
        ];

        // ① baseRate（多人含 50% Fever）
        const baseRate = musicMeta.base_score + musicMeta.fever_score * 0.5;

        // ② Skill 1-5 贡献（随机分配 → 按策略处理）
        const w15 = w.slice(0, 5);
        const effs = allPlayers.map((p) => p.effectiveness);
        const skill15Contribution = this.computeSkill15(effs, w15, this._skill15Strategy);

        // 同时算出最优/最差用于参考
        const skill15Best = this.computeSkill15(effs, w15, Skill15Strategy.BEST);
        const skill15Worst = this.computeSkill15(effs, w15, Skill15Strategy.WORST);

        // ③ Skill 6 贡献
        const skill6Eff = this.resolveSkill6Effectiveness(allPlayers);
        const skill6Contribution = skill6Eff * w[5] / 100;

        // ④ 活跃加分 = 5 × 1.5% × 全队总综合
        const totalPower = allPlayers.reduce((s, p) => s + p.power, 0);
        const activeBonus = 5 * 0.015 * totalPower;

        // ⑤ 总比率
        const totalRate = baseRate + skill15Contribution + skill6Contribution;

        // ⑥ 最终得分
        const score = Math.floor(totalRate * userPower * 4 + activeBonus);

        // 最优/最差得分参考
        const scoreBest = Math.floor(
            (baseRate + skill15Best + skill6Contribution) * userPower * 4 + activeBonus,
        );
        const scoreWorst = Math.floor(
            (baseRate + skill15Worst + skill6Contribution) * userPower * 4 + activeBonus,
        );

        return {
            score,
            baseScorePart: Math.floor(baseRate * userPower * 4),
            skill15Part: Math.floor(skill15Contribution * userPower * 4),
            skill6Part: Math.floor(skill6Contribution * userPower * 4),
            activeBonus: Math.floor(activeBonus),
            totalPower,
            skill6Effectiveness: skill6Eff,
            skill6Mode: this._skill6Mode,
            skill15Strategy: this._skill15Strategy,
            details: {
                baseRate,
                skill15Contribution,
                skill6Contribution,
                totalRate,
                userPower,
                allPlayers,
                scoreBest,
                scoreWorst,
            },
        };
    }

    // ───────── PT 计算 ─────────

    /**
     * 计算活动 PT
     * @param scoreResult - calculate() 的结果
     * @param musicMeta - 歌曲 Meta（需含 event_rate）
     * @param deckBonus - 卡组加成百分比 (如 150 表示 150%)
     * @param fires - 火罐数量 (0-10)
     */
    calculatePT(
        scoreResult: CalculationResult,
        musicMeta: MusicMeta,
        deckBonus: number,
        fires: number,
    ): PTResult {
        const selfScore = scoreResult.score;

        // 其他 4 名玩家各自的得分
        const { totalRate, allPlayers } = scoreResult.details;
        const activeBonus = scoreResult.activeBonus;
        let otherScore = 0;
        for (let i = 1; i < allPlayers.length; i++) {
            otherScore += Math.floor(totalRate * allPlayers[i].power * 4 + activeBonus);
        }

        // PT 公式
        const basePT = 110 + Math.floor(selfScore / 17000) + Math.min(13, Math.floor(otherScore / 340000));
        const eventRate = musicMeta.event_rate || 100;
        const deckRate = 1 + deckBonus / 100;
        const boostRate = getBoostRate(fires);
        const pt = Math.floor(basePT * eventRate / 100 * deckRate) * boostRate;

        return {
            pt,
            basePT,
            selfScore,
            otherScore,
            eventRate,
            deckRate,
            boostRate,
            fires,
            deckBonus,
        };
    }

    // ───────── 内部方法 ─────────

    /**
     * 计算 Skill1-5 的贡献
     */
    private computeSkill15(
        effs: number[],
        weights: number[],
        strategy: Skill15Strategy,
    ): number {
        const n = effs.length; // 5
        switch (strategy) {
            case Skill15Strategy.EXPECTED: {
                const avgEff = effs.reduce((s, e) => s + e, 0) / n;
                const sumW = weights.reduce((s, w) => s + w, 0);
                return avgEff * sumW / 100;
            }
            case Skill15Strategy.BEST: {
                const sortedEff = [...effs].sort((a, b) => b - a);
                const sortedW = [...weights].sort((a, b) => b - a);
                return sortedEff.reduce((s, e, i) => s + e * sortedW[i] / 100, 0);
            }
            case Skill15Strategy.WORST: {
                const sortedEff = [...effs].sort((a, b) => b - a);
                const sortedW = [...weights].sort((a, b) => a - b);
                return sortedEff.reduce((s, e, i) => s + e * sortedW[i] / 100, 0);
            }
        }
    }

    private resolveSkill6Effectiveness(allPlayers: PlayerConfig[]): number {
        if (this._skill6Mode === Skill6Mode.TEAM_AVERAGE) {
            return allPlayers.reduce((s, p) => s + p.effectiveness, 0) / allPlayers.length;
        }
        return allPlayers.reduce(
            (best, p) => (p.power > best.power ? p : best),
            allPlayers[0],
        ).effectiveness;
    }
}
