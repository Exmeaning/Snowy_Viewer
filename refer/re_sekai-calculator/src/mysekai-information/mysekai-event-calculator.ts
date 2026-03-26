import { type DeckDetail } from '../deck-information/deck-calculator'
import { type MusicMeta } from '../common/music-meta'
import { type ScoreFunction } from '../deck-recommend/base-deck-recommend'
import { safeNumber } from '../util/number-util'

/**
 * 烤森活动点数计算结果
 */
export interface MysekaiScore {
  /** 烤森活动点数（分段后） */
  mysekaiEventPoint: number
  /** 未分段的内部点数（用于优化） */
  mysekaiInternalPoint: number
}

export class MysekaiEventCalculator {
  /**
   * 获得卡组的烤森活动点数
   * 公式来源：@SYLVIA0x0
   * @param deckDetail 卡组
   */
  public static getDeckMysekaiEventPoint (deckDetail: DeckDetail): MysekaiScore {
    const power = deckDetail.power.total
    const eventBonus = safeNumber(deckDetail.eventBonus) + safeNumber(deckDetail.supportDeckBonus)

    let powerBonus = 1 + (power / 450000)
    powerBonus = Math.floor(powerBonus * 10 + 1e-6) / 10.0

    const eventBonusRate = Math.floor(eventBonus + 1e-6) / 100.0

    return {
      mysekaiEventPoint: Math.floor(powerBonus * (1 + eventBonusRate) + 1e-6) * 500,
      mysekaiInternalPoint: powerBonus * (1 + eventBonusRate) * 500
    }
  }

  /**
   * 获取计算烤森活动点数的函数（作为ScoreFunction使用）
   * 返回的分数为 mysekaiInternalPoint（连续值，用于优化）
   */
  public static getMysekaiEventPointFunction (): ScoreFunction {
    return (_musicMeta: MusicMeta, deckDetail: DeckDetail) => {
      const result = MysekaiEventCalculator.getDeckMysekaiEventPoint(deckDetail)
      return result.mysekaiInternalPoint
    }
  }
}
