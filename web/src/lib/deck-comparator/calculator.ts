/**
 * Simple multi-live song PT calculator.
 */

// ======================== Type definitions ========================

export interface MusicMeta {
    music_id: number;
    difficulty: string;
    music_time: number;
    base_score: number;
    fever_score: number;
    tap_count: number;
    event_rate: number;
    skill_score_solo: number[];
    /** Multi-live weights for 6 skill slots: [slot0 .. slot4, slot5(Skill6)] */
    skill_score_multi: number[];
    skill_score_auto: number[];
    base_score_auto: number;
}

export interface PlayerConfig {
    /** Deck power */
    power: number;
    /** Skill value (%) */
    effectiveness: number;
}

/** Skill6 trigger mode */
export enum Skill6Mode {
    /** Arithmetic average skill value of all 5 players */
    TEAM_AVERAGE = 'team_average',
    /** Skill value of the player with the highest power */
    HIGHEST_POWER = 'highest_power',
}

/** Skill1-5 arrangement strategy */
export enum Skill15Strategy {
    /** Expected value when all arrangements are equally likely */
    EXPECTED = 'expected',
    /** Best arrangement: higher skill value with higher weight */
    BEST = 'best',
    /** Worst arrangement: higher skill value with lower weight */
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
        /** Best/worst score references when weights are not all equal */
        scoreBest: number;
        scoreWorst: number;
    };
}

export interface PTResult {
    /** Final event PT */
    pt: number;
    /** Base PT value (110 + selfScore/17000 + min(13, otherScore/340000)) */
    basePT: number;
    /** User score */
    selfScore: number;
    /** Total score from the other 4 players */
    otherScore: number;
    /** Event song multiplier (event_rate) */
    eventRate: number;
    /** Deck bonus multiplier (1 + deckBonus/100) */
    deckRate: number;
    /** Boost energy multiplier */
    boostRate: number;
    /** Boost energy count */
    fires: number;
    /** Deck bonus percentage */
    deckBonus: number;
}

// ======================== Boost energy multipliers ========================

/** Boost energy count to multiplier: 0=1x, 1~5=5x per energy, 6~10=27/29/31/33/35 */
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

// ======================== Core calculator ========================

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

    // ───────── Teammate config ─────────

    setTeammate(index: number, power: number, effectiveness: number): void {
        if (index < 0 || index >= 4) {
            throw new RangeError("page.deckComparator.errors.invalidTeammateIndex", { cause: { index } });
        }
        this.teammates[index] = { power, effectiveness };
    }

    setAllTeammates(power: number, effectiveness: number): void {
        for (let i = 0; i < 4; i++) this.teammates[i] = { power, effectiveness };
    }

    getTeammates(): readonly PlayerConfig[] {
        return this.teammates;
    }

    // ───────── Skill6 mode ─────────

    setSkill6Mode(mode: Skill6Mode): void {
        this._skill6Mode = mode;
    }

    get skill6Mode(): Skill6Mode {
        return this._skill6Mode;
    }

    // ───────── Skill1-5 strategy ─────────

    setSkill15Strategy(strategy: Skill15Strategy): void {
        this._skill15Strategy = strategy;
    }

    get skill15Strategy(): Skill15Strategy {
        return this._skill15Strategy;
    }

    // ───────── Calculation ─────────

    calculate(
        userPower: number,
        userEffectiveness: number,
        musicMeta: MusicMeta,
    ): CalculationResult {
        const w = musicMeta.skill_score_multi;
        if (!w || w.length < 6) {
            throw new Error("page.deckComparator.errors.invalidSkillWeights", { cause: { count: w?.length ?? 0 } });
        }

        // All 5 players (user + 4 teammates)
        const allPlayers: PlayerConfig[] = [
            { power: userPower, effectiveness: userEffectiveness },
            ...this.teammates.map((t) => ({ ...t })),
        ];

        // 1. baseRate (multi-live includes 50% Fever)
        const baseRate = musicMeta.base_score + musicMeta.fever_score * 0.5;

        // 2. Skill 1-5 contribution (random assignment handled by strategy)
        const w15 = w.slice(0, 5);
        const effs = allPlayers.map((p) => p.effectiveness);
        const skill15Contribution = this.computeSkill15(effs, w15, this._skill15Strategy);

        // Also calculate best/worst references
        const skill15Best = this.computeSkill15(effs, w15, Skill15Strategy.BEST);
        const skill15Worst = this.computeSkill15(effs, w15, Skill15Strategy.WORST);

        // 3. Skill 6 contribution
        const skill6Eff = this.resolveSkill6Effectiveness(allPlayers);
        const skill6Contribution = skill6Eff * w[5] / 100;

        // 4. Active bonus = 5 × 1.5% × total team power
        const totalPower = allPlayers.reduce((s, p) => s + p.power, 0);
        const activeBonus = 5 * 0.015 * totalPower;

        // 5. Total rate
        const totalRate = baseRate + skill15Contribution + skill6Contribution;

        // 6. Final score
        const score = Math.floor(totalRate * userPower * 4 + activeBonus);

        // Best/worst score references
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

    // ───────── PT calculation ─────────

    /**
     * Calculate event PT.
     * @param scoreResult - Result from calculate()
     * @param musicMeta - Song Meta data, including event_rate
     * @param deckBonus - Deck bonus percentage, e.g. 150 means 150%
     * @param fires - Boost energy count (0-10)
     */
    calculatePT(
        scoreResult: CalculationResult,
        musicMeta: MusicMeta,
        deckBonus: number,
        fires: number,
    ): PTResult {
        const selfScore = scoreResult.score;

        // Scores for the other 4 players
        const { totalRate, allPlayers } = scoreResult.details;
        const activeBonus = scoreResult.activeBonus;
        let otherScore = 0;
        for (let i = 1; i < allPlayers.length; i++) {
            otherScore += Math.floor(totalRate * allPlayers[i].power * 4 + activeBonus);
        }

        // PT formula
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

    // ───────── Internal methods ─────────

    /**
     * Calculate Skill1-5 contribution.
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
