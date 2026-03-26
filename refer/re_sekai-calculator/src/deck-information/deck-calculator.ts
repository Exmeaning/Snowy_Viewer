import { type DataProvider } from '../data-provider/data-provider'
import type { UserCard } from '../user-data/user-card'
import { type UserHonor } from '../user-data/user-honor'
import { type Honor } from '../master-data/honor'
import { CardCalculator, type CardDetail } from '../card-information/card-calculator'
import { computeWithDefault, findOrThrow, getOrThrow } from '../util/collection-util'
import { EventCalculator } from '../event-point/event-calculator'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type EventConfig } from '../event-point/event-service'
import type { WorldBloomDifferentAttributeBonus } from '../master-data/world-bloom-different-attribute-bonus'
import type { DeckCardSkillDetailPrepare } from '../card-information/card-skill-calculator'

/** 吸技能选择策略 */
export enum SkillReferenceChooseStrategy {
  /** 取最大值 */
  Max = 'max',
  /** 取最小值 */
  Min = 'min',
  /** 取平均值 */
  Average = 'average'
}

export class DeckCalculator {
  private readonly cardCalculator: CardCalculator
  private readonly eventCalculator: EventCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.eventCalculator = new EventCalculator(dataProvider)
  }

  /**
   * 获取称号的综合力加成（与卡牌无关、根据称号累加）
   */
  public async getHonorBonusPower (): Promise<number> {
    const honors = await this.dataProvider.getMasterData<Honor>('honors')
    const userHonors = await this.dataProvider.getUserData<UserHonor[]>('userHonors')
    return userHonors
      .map(userHonor => {
        const honor = findOrThrow(honors, it => it.id === userHonor.honorId)
        return findOrThrow(honor.levels, it => it.level === userHonor.level)
      })
      .reduce((v, it) => v + it.bonus, 0)
  }

  /**
   * 计算给定的多张卡牌综合力、技能（支持花前花后枚举）
   * @param cardDetails 处理好的卡牌详情（数组长度1-5，兼容挑战Live）
   * @param allCards 参与计算的所有卡，按支援队伍加成从大到小排序
   * @param honorBonus 称号加成
   * @param cardBonusCountLimit 特定卡牌加成数量限制（用于World Link Finale）
   * @param worldBloomDifferentAttributeBonuses （可选）World Link不同属性加成
   * @param skillReferenceChooseStrategy 吸技能选择策略
   * @param keepAfterTrainingState 是否保持用户设置的花前花后状态
   * @param bestSkillAsLeader 是否自动将技能最高的卡放到队长位
   */
  public static getDeckDetailByCards (
    cardDetails: CardDetail[], allCards: CardDetail[], honorBonus: number,
    cardBonusCountLimit?: number,
    worldBloomDifferentAttributeBonuses?: WorldBloomDifferentAttributeBonus[],
    skillReferenceChooseStrategy: SkillReferenceChooseStrategy = SkillReferenceChooseStrategy.Average,
    keepAfterTrainingState: boolean = false,
    bestSkillAsLeader: boolean = true
  ): DeckDetail {
    const cardNum = cardDetails.length

    // 预处理队伍和属性，存储每个队伍或属性出现的次数
    const unitMap = new Map<string, number>()
    const attrMap = new Map<string, number>()
    for (const cardDetail of cardDetails) {
      computeWithDefault(attrMap, cardDetail.attr, 0, it => it + 1)
      cardDetail.units.forEach(key => {
        computeWithDefault(unitMap, key, 0, it => it + 1)
      })
    }

    // 计算不同组合数量（用于异组技能）
    let unitNum = 0
    for (const [, count] of unitMap) {
      if (count > 0) unitNum++
    }

    // 计算当前卡组的综合力，要加上称号的固定加成
    const cardPower = new Map<number, DeckCardPowerDetail>()
    cardDetails.forEach(cardDetail => {
      cardPower.set(cardDetail.cardId,
        cardDetail.units.reduce((vv, unit) => {
          const current =
            cardDetail.power.getPower(unit, getOrThrow(unitMap, unit), getOrThrow(attrMap, cardDetail.attr))
          return current.total > vv.total ? current : vv
        },
        cardDetail.power.getPower(cardDetail.units[0],
          getOrThrow(unitMap, cardDetail.units[0]), getOrThrow(attrMap, cardDetail.attr))
        ))
    })

    const base = DeckCalculator.sumPower(cardDetails, cardPower, it => it.base)
    const areaItemBonus = DeckCalculator.sumPower(cardDetails, cardPower, it => it.areaItemBonus)
    const characterBonus = DeckCalculator.sumPower(cardDetails, cardPower, it => it.characterBonus)
    const fixtureBonus = DeckCalculator.sumPower(cardDetails, cardPower, it => it.fixtureBonus)
    const gateBonus = DeckCalculator.sumPower(cardDetails, cardPower, it => it.gateBonus)
    const total = DeckCalculator.sumPower(cardDetails, cardPower, it => it.total) + honorBonus
    const power = { base, areaItemBonus, characterBonus, honorBonus, fixtureBonus, gateBonus, total }

    // ========== 花前花后技能枚举 ==========

    // 预处理每张卡的花前/花后技能
    // [s1=花前, s2=花後]
    const prepareSkills: Array<[DeckCardSkillDetailPrepare, DeckCardSkillDetailPrepare]> = []
    let doubleSkillMask = 0
    let needEnumerateStatusMask = 0

    for (let i = 0; i < cardNum; ++i) {
      const cardDetail = cardDetails[i]
      const hasDouble = cardDetail.skill.hasPreTraining

      // 花後技能：从主 map 取最优（只从 unit-based 技能中取，不检查 ref/diff）
      let s2: DeckCardSkillDetailPrepare = { skillId: 0, isAfterTraining: false, scoreUpFixed: 0, scoreUpToReference: 0, lifeRecovery: 0 }
      for (const unit of cardDetail.units) {
        const current = cardDetail.skill.getSkill(unit, getOrThrow(unitMap, unit))
        if (current.scoreUpFixed > s2.scoreUpFixed) s2 = { ...current }
      }

      // 花前技能：从 preTraining map 取最优
      let s1: DeckCardSkillDetailPrepare = { skillId: 0, isAfterTraining: false, scoreUpFixed: 0, scoreUpToReference: 0, lifeRecovery: 0 }
      let needEnumerate = false

      if (hasDouble) {
        // 吸分技能效果(max)
        try {
          const refSkill = cardDetail.skill.getPreTrainingSkill('ref', 1)
          const refScoreUp = refSkill.scoreUpFixed + (refSkill.scoreUpReferenceMax ?? 0)
          if (refSkill.skillId !== s2.skillId && refScoreUp > s1.scoreUpFixed) {
            s1 = { ...refSkill, scoreUpFixed: refScoreUp, scoreUpToReference: refScoreUp }
            needEnumerate = true // 吸分技能需要枚举
          }
        } catch (_) { /* no ref */ }
        // 异组技能效果
        try {
          const diffSkill = cardDetail.skill.getPreTrainingSkill('diff', unitNum - 1)
          if (diffSkill.skillId !== s2.skillId && diffSkill.scoreUpFixed > s1.scoreUpFixed) {
            s1 = { ...diffSkill }
            needEnumerate = false // 异组技能不需要枚举
          }
        } catch (_) { /* no diff */ }

        // 记录有双技能的位置
        doubleSkillMask |= (1 << i)
      }

      if (keepAfterTrainingState) {
        // 保持用户设置状态，不枚举
        if (hasDouble && cardDetail.defaultImage !== 'special_training') {
          // 用户设置为花前
          s2 = { ...s1 }
        }
        // 否则保持 s2（花後）
      } else {
        if (hasDouble) {
          if (needEnumerate) {
            needEnumerateStatusMask |= (1 << i)
          } else {
            // 不需要枚举则取两个技能的最大
            s2 = s2.scoreUpFixed >= s1.scoreUpFixed ? s2 : s1
          }
        }
      }

      prepareSkills.push([s1, s2])
    }

    // 枚举技能状态，找到最优组合
    let bestDeckResult: {
      cards: DeckCardDetail[]
      multiLiveScoreUp: number
      targetScore: number
    } | undefined

    for (let mask = needEnumerateStatusMask; mask >= 0; mask = mask > 0 ? (mask - 1) & needEnumerateStatusMask : -1) {
      // 根据mask选择花前/花后技能
      const skills: DeckCardSkillDetailPrepare[] = []
      for (let i = 0; i < cardNum; ++i) {
        const [s1, s2] = prepareSkills[i]
        const s = (mask & (1 << i)) !== 0 ? { ...s1 } : { ...s2 }
        // 被吸技能时的值：所有卡都按 scoreUpFixed 来算（吸技能卡按最高膨胀值）
        s.scoreUpToReference = s.scoreUpFixed
        skills.push(s)
      }

      // 计算吸分技能的实际值
      for (let i = 0; i < cardNum; ++i) {
        const s = skills[i]
        if (s.hasScoreUpReference === true && s.scoreUpReferenceRate !== undefined && s.scoreUpReferenceMax !== undefined) {
          const baseFixed = s.scoreUpFixed - s.scoreUpReferenceMax
          // 从max回到基础值
          s.scoreUpFixed = baseFixed
          // 收集其他成员的吸分值
          const memberSkillMaxs: number[] = []
          for (let j = 0; j < cardNum; ++j) {
            if (i === j) continue
            const m = Math.min(
              Math.floor(skills[j].scoreUpToReference * s.scoreUpReferenceRate / 100),
              s.scoreUpReferenceMax
            )
            memberSkillMaxs.push(m)
          }
          // 根据策略选择
          let chosenSkillMax = 0
          if (skillReferenceChooseStrategy === SkillReferenceChooseStrategy.Max) {
            chosenSkillMax = Math.max(...memberSkillMaxs)
          } else if (skillReferenceChooseStrategy === SkillReferenceChooseStrategy.Min) {
            chosenSkillMax = Math.min(...memberSkillMaxs)
          } else {
            chosenSkillMax = memberSkillMaxs.reduce((a, b) => a + b, 0) / memberSkillMaxs.length
          }
          s.scoreUpFixed += chosenSkillMax
        }
      }

      // 确定队长顺序
      const order = Array.from({ length: cardNum }, (_, i) => i)
      if (bestSkillAsLeader) {
        let bestIndex = 0
        for (let i = 1; i < cardNum; ++i) {
          if (skills[order[i]].scoreUpFixed > skills[order[bestIndex]].scoreUpFixed) {
            bestIndex = i
          } else if (skills[order[i]].scoreUpFixed === skills[order[bestIndex]].scoreUpFixed &&
            cardDetails[order[i]].cardId < cardDetails[order[bestIndex]].cardId) {
            bestIndex = i
          }
        }
        if (bestIndex !== 0) {
          const tmp = order[0]; order[0] = order[bestIndex]; order[bestIndex] = tmp
        }
      }

      // 检查是否劣于已有结果（简单剪枝）
      let leaderScoreUp = 0
      let otherScoreUpSum = 0
      for (let k = 0; k < cardNum; ++k) {
        if (k === 0) leaderScoreUp = skills[order[k]].scoreUpFixed
        else otherScoreUpSum += skills[order[k]].scoreUpFixed
      }
      const currentScore = leaderScoreUp + otherScoreUpSum

      if (bestDeckResult !== undefined && currentScore <= bestDeckResult.targetScore) {
        continue
      }

      // 归纳卡牌在队伍中的详情信息
      const cards: DeckCardDetail[] = []
      for (const idx of order) {
        const cardDetail = cardDetails[idx]
        // 确定卡面状态
        let defaultImage = cardDetail.defaultImage
        if ((doubleSkillMask & (1 << idx)) !== 0) {
          defaultImage = skills[idx].isAfterTraining ? 'special_training' : 'original'
        }
        cards.push({
          cardId: cardDetail.cardId,
          level: cardDetail.level,
          skillLevel: cardDetail.skillLevel,
          masterRank: cardDetail.masterRank,
          power: getOrThrow(cardPower, cardDetail.cardId),
          eventBonus: cardDetail.eventBonus?.getBonusForDisplay(idx === order[0]),
          skill: {
            scoreUp: skills[idx].scoreUpFixed,
            lifeRecovery: skills[idx].lifeRecovery,
            isPreTrainingSkill: !skills[idx].isAfterTraining && (doubleSkillMask & (1 << idx)) !== 0 ? true : undefined
          },
          defaultImage
        })
      }

      // 计算多人live的技能实效
      let multiLiveScoreUp = skills[order[0]].scoreUpFixed
      for (let i = 1; i < cardNum; ++i) {
        multiLiveScoreUp += skills[order[i]].scoreUpFixed * 0.2
      }

      bestDeckResult = { cards, multiLiveScoreUp, targetScore: currentScore }
    }

    // 如果没有枚举（无双技能卡），直接用默认逻辑
    if (bestDeckResult === undefined) {
      bestDeckResult = DeckCalculator.computeDefaultDeck(
        cardDetails, cardPower, unitMap, bestSkillAsLeader
      )
    }

    // 计算卡组活动加成
    const eventBonus = EventCalculator.getDeckBonus(
      cardDetails, cardBonusCountLimit, worldBloomDifferentAttributeBonuses)
    const supportDeckBonus =
        worldBloomDifferentAttributeBonuses !== undefined
          ? EventCalculator.getSupportDeckBonus(cardDetails, allCards).bonus
          : 0

    return {
      power,
      eventBonus,
      supportDeckBonus,
      cards: bestDeckResult.cards,
      multiLiveScoreUp: bestDeckResult.multiLiveScoreUp
    }
  }

  /**
   * 无双技能卡时的默认计算
   */
  private static computeDefaultDeck (
    cardDetails: CardDetail[],
    cardPower: Map<number, DeckCardPowerDetail>,
    unitMap: Map<string, number>,
    bestSkillAsLeader: boolean
  ): { cards: DeckCardDetail[], multiLiveScoreUp: number, targetScore: number } {
    const cardNum = cardDetails.length
    const cardsPrepare = cardDetails.map(cardDetail => {
      const skillPrepare =
          cardDetail.units.reduce((vv, unit) => {
            const current = cardDetail.skill.getSkill(unit, getOrThrow(unitMap, unit))
            return current.scoreUpFixed > vv.scoreUpFixed ? current : vv
          },
          cardDetail.skill.getSkill('any', 1))
      return { cardDetail, skillPrepare }
    })

    const order = Array.from({ length: cardNum }, (_, i) => i)
    if (bestSkillAsLeader) {
      let bestIndex = 0
      for (let i = 1; i < cardNum; ++i) {
        if (cardsPrepare[i].skillPrepare.scoreUpFixed > cardsPrepare[bestIndex].skillPrepare.scoreUpFixed) {
          bestIndex = i
        }
      }
      if (bestIndex !== 0) {
        const tmp = order[0]; order[0] = order[bestIndex]; order[bestIndex] = tmp
      }
    }

    const cards: DeckCardDetail[] = order.map(idx => {
      const { cardDetail, skillPrepare } = cardsPrepare[idx]
      return {
        cardId: cardDetail.cardId,
        level: cardDetail.level,
        skillLevel: cardDetail.skillLevel,
        masterRank: cardDetail.masterRank,
        power: getOrThrow(cardPower, cardDetail.cardId),
        eventBonus: cardDetail.eventBonus?.getBonusForDisplay(idx === order[0]),
        skill: {
          scoreUp: skillPrepare.scoreUpFixed,
          lifeRecovery: skillPrepare.lifeRecovery
        },
        defaultImage: cardDetail.defaultImage
      }
    })

    let multiLiveScoreUp = cardsPrepare[order[0]].skillPrepare.scoreUpFixed
    for (let i = 1; i < cardNum; ++i) {
      multiLiveScoreUp += cardsPrepare[order[i]].skillPrepare.scoreUpFixed * 0.2
    }

    const targetScore = cardsPrepare.reduce((sum, it) => sum + it.skillPrepare.scoreUpFixed, 0)
    return { cards, multiLiveScoreUp, targetScore }
  }

  /**
   * 求和单项综合力
   */
  private static sumPower (
    cardDetails: CardDetail[], cardPower: Map<number, DeckCardPowerDetail>,
    attr: (_: DeckCardPowerDetail) => number
  ): number {
    return cardDetails.reduce((v, cardDetail) =>
      v + attr(getOrThrow(cardPower, cardDetail.cardId)),
    0)
  }

  /**
   * 根据用户卡组获得卡组详情
   * @param deckCards 用户卡组中的用户卡牌
   * @param allCards 用户全部卡牌
   * @param eventConfig （可选）活动设置
   * @param areaItemLevels （可选）使用的区域道具
   */
  public async getDeckDetail (
    deckCards: UserCard[], allCards: UserCard[], eventConfig?: EventConfig, areaItemLevels?: AreaItemLevel[]
  ): Promise<DeckDetail> {
    const allCards0 =
        await this.cardCalculator.batchGetCardDetail(allCards, {}, eventConfig, areaItemLevels)

    return DeckCalculator.getDeckDetailByCards(
      await this.cardCalculator.batchGetCardDetail(deckCards, {}, eventConfig, areaItemLevels),
      allCards0, await this.getHonorBonusPower(), eventConfig?.cardBonusCountLimit,
      eventConfig?.worldBloomDifferentAttributeBonuses)
  }
}

export interface DeckDetail {
  power: DeckPowerDetail
  eventBonus?: number
  supportDeckBonus?: number
  cards: DeckCardDetail[]
  /** 多人live技能实效 */
  multiLiveScoreUp: number
}

export interface DeckCardDetail {
  cardId: number
  level: number
  skillLevel: number
  masterRank: number
  power: DeckCardPowerDetail
  eventBonus?: string
  skill: DeckCardSkillDetail
  /** 卡面状态（original/special_training） */
  defaultImage?: string
}

export interface DeckPowerDetail {
  base: number
  areaItemBonus: number
  characterBonus: number
  honorBonus: number
  fixtureBonus: number
  gateBonus: number
  total: number
}

export interface DeckCardPowerDetail {
  base: number
  areaItemBonus: number
  characterBonus: number
  fixtureBonus: number
  gateBonus: number
  total: number
}

export interface DeckCardSkillDetail {
  /** 最终计算出的卡组加分 */
  scoreUp: number
  lifeRecovery: number
  /** 是否使用了觉醒前（花前）技能 */
  isPreTrainingSkill?: boolean
}
