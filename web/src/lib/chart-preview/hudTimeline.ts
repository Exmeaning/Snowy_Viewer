import type { HudEvent, HudRuntimeState } from './types'

const TEAM_POWER = 250000
const RATING = 26
const JUDGE_VISIBLE_WINDOW_SEC = 0.24
const SCORE_DELTA_VISIBLE_WINDOW_SEC = 0.5

const rankBorder = 1200000 + (RATING - 5) * 4100
const rankS = 1040000 + (RATING - 5) * 5200
const rankA = 840000 + (RATING - 5) * 4200
const rankB = 400000 + (RATING - 5) * 2000
const rankC = 20000 + (RATING - 5) * 100

const rankBorderPos = 1650 / 1650
const rankSPos = 1478 / 1650
const rankAPos = 1234 / 1650
const rankBPos = 990 / 1650
const rankCPos = 746 / 1650

const kindOrder: Record<HudEvent['kind'], number> = {
  tap: 0,
  criticalTap: 1,
  flick: 2,
  trace: 3,
  tick: 4,
  holdHalfBeat: 5,
}

function upperBound(sortedValues: readonly number[], target: number) {
  let low = 0
  let high = sortedValues.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (sortedValues[mid] <= target + 0.0001) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function lerp(value: number, start: number, end: number, startPos: number, endPos: number) {
  if (end <= start) {
    return endPos
  }
  return ((value - start) / (end - start)) * (endPos - startPos) + startPos
}

function getRankAndScoreBar(score: number): Pick<HudRuntimeState, 'rank' | 'scoreBarRatio'> {
  if (score < 0) {
    return { rank: 'd', scoreBarRatio: 0 }
  }
  if (score >= rankBorder) {
    return { rank: 's', scoreBarRatio: rankBorderPos }
  }
  if (score >= rankS) {
    return { rank: 's', scoreBarRatio: clamp01(lerp(score, rankS, rankBorder, rankSPos, rankBorderPos)) }
  }
  if (score >= rankA) {
    return { rank: 'a', scoreBarRatio: clamp01(lerp(score, rankA, rankS, rankAPos, rankSPos)) }
  }
  if (score >= rankB) {
    return { rank: 'b', scoreBarRatio: clamp01(lerp(score, rankB, rankA, rankBPos, rankAPos)) }
  }
  if (score >= rankC) {
    return { rank: 'c', scoreBarRatio: clamp01(lerp(score, rankC, rankB, rankCPos, rankBPos)) }
  }
  return {
    rank: 'd',
    scoreBarRatio: clamp01((score / Math.max(rankC, 1)) * rankCPos),
  }
}

export class HudTimeline {
  private readonly timelineTimes: number[]
  private readonly timelineScores: number[]
  private readonly timelineCombos: number[]
  private readonly timelineRanks: HudRuntimeState['rank'][]
  private readonly timelineScoreBars: number[]
  private readonly timelineScoreDeltas: number[]
  private readonly timelineLastJudgeTimes: number[]

  constructor(events: HudEvent[]) {
    const sorted = [...events].sort((left, right) => {
      if (left.timeSec === right.timeSec) {
        return kindOrder[left.kind] - kindOrder[right.kind]
      }
      return left.timeSec - right.timeSec
    })

    this.timelineTimes = new Array(sorted.length)
    this.timelineScores = new Array(sorted.length)
    this.timelineCombos = new Array(sorted.length)
    this.timelineRanks = new Array(sorted.length)
    this.timelineScoreBars = new Array(sorted.length)
    this.timelineScoreDeltas = new Array(sorted.length)
    this.timelineLastJudgeTimes = new Array(sorted.length)

    const weightedNotesCount = Math.max(
      sorted.reduce((sum, event) => sum + Math.max(0, event.weight), 0),
      1,
    )
    const levelFax = (RATING - 5) * 0.005 + 1

    let combo = 0
    let comboFax = 1
    let score = 0
    let lastJudgeTime = Number.NEGATIVE_INFINITY

    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index]
      combo += 1
      if (combo % 100 === 1 && combo > 1) {
        comboFax = Math.min(comboFax + 0.01, 1.1)
      }

      const scoreDelta =
        (TEAM_POWER / weightedNotesCount) *
        4 *
        Math.max(0, event.weight) *
        levelFax *
        comboFax
      score += scoreDelta

      if (event.showJudge) {
        lastJudgeTime = event.timeSec
      }

      const rankAndBar = getRankAndScoreBar(score)
      this.timelineTimes[index] = event.timeSec
      this.timelineScores[index] = score
      this.timelineCombos[index] = combo
      this.timelineRanks[index] = rankAndBar.rank
      this.timelineScoreBars[index] = rankAndBar.scoreBarRatio
      this.timelineScoreDeltas[index] = scoreDelta
      this.timelineLastJudgeTimes[index] = lastJudgeTime
    }
  }

  snapshotAt(timeSec: number): HudRuntimeState {
    if (this.timelineTimes.length === 0) {
      return {
        score: 0, combo: 0, rank: 'd', scoreBarRatio: 0,
        scoreDelta: 0, scoreDeltaEventIndex: -1,
        latestScoreDelta: 0, latestScoreEventIndex: -1,
        showPerfect: false, lifeRatio: 1,
      }
    }

    const index = upperBound(this.timelineTimes, timeSec) - 1
    if (index < 0) {
      return {
        score: 0, combo: 0, rank: 'd', scoreBarRatio: 0,
        scoreDelta: 0, scoreDeltaEventIndex: -1,
        latestScoreDelta: 0, latestScoreEventIndex: -1,
        showPerfect: false, lifeRatio: 1,
      }
    }

    const scoreDeltaVisible =
      timeSec >= this.timelineTimes[index] - 0.0001 &&
      timeSec <= this.timelineTimes[index] + SCORE_DELTA_VISIBLE_WINDOW_SEC

    const judgeTime = this.timelineLastJudgeTimes[index]
    const showPerfect =
      Number.isFinite(judgeTime) && timeSec >= judgeTime - 0.0001 && timeSec <= judgeTime + JUDGE_VISIBLE_WINDOW_SEC

    return {
      score: Math.max(0, Math.round(this.timelineScores[index])),
      combo: this.timelineCombos[index],
      rank: this.timelineRanks[index],
      scoreBarRatio: this.timelineScoreBars[index],
      scoreDelta: scoreDeltaVisible ? Math.max(0, Math.round(this.timelineScoreDeltas[index])) : 0,
      scoreDeltaEventIndex: scoreDeltaVisible ? index : -1,
      latestScoreDelta: Math.max(0, Math.round(this.timelineScoreDeltas[index])),
      latestScoreEventIndex: index,
      showPerfect,
      lifeRatio: 1,
    }
  }
}
