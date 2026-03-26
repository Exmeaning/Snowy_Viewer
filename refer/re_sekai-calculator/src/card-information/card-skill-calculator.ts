import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type Skill } from '../master-data/skill'
import type { UserCharacter } from '../user-data/user-character'
import { CardDetailMapSkill } from './card-detail-map-skill'

export class CardSkillCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获得不同情况下的卡牌技能（花前+花后分别处理）
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param scoreUpLimit World Link Finale卡牌技能限制
   */
  public async getCardSkill (
    userCard: UserCard, card: Card, scoreUpLimit: number = Number.MAX_SAFE_INTEGER
  ): Promise<CardDetailMapSkill> {
    const skillMap = new CardDetailMapSkill()

    // 花前技能（原始技能）
    const detailBefore = await this.getSkillDetail(userCard, card, false)
    // 花后技能（觉醒后特殊技能，如果有的话）
    const detailAfter = card.specialTrainingSkillId !== undefined
      ? await this.getSkillDetail(userCard, card, true)
      : undefined

    // 辅助函数：将一个技能详情填入指定的 setter
    const fillSkill = (
      detail: SkillDetailInternal,
      setter: (unit: string, unitMember: number, attrMember: number, cmpValue: number, value: DeckCardSkillDetailPrepare) => void
    ): void => {
      const scoreUpSelfFixed = detail.scoreUpBasic + detail.scoreUpCharacterRank
      const deckSkill: DeckCardSkillDetailPrepare = {
        skillId: detail.skillId,
        isAfterTraining: detail.isAfterTraining,
        scoreUpFixed: Math.min(scoreUpSelfFixed, scoreUpLimit),
        scoreUpToReference: Math.min(scoreUpSelfFixed, scoreUpLimit),
        lifeRecovery: detail.lifeRecovery
      }

      // 固定加成（保底）
      setter('any', 1, 1, deckSkill.scoreUpFixed, deckSkill)

      // V家限定组分
      if (detail.scoreUpSameUnit !== undefined) {
        for (let i = 1; i <= 5; ++i) {
          const dd = { ...deckSkill }
          dd.scoreUpFixed += (i === 5 ? 5 : (i - 1)) * detail.scoreUpSameUnit.value
          dd.scoreUpFixed = Math.min(dd.scoreUpFixed, scoreUpLimit)
          dd.scoreUpToReference = dd.scoreUpFixed
          setter(detail.scoreUpSameUnit.unit, i, 1, dd.scoreUpFixed, dd)
        }
      }

      // Bloom FES 原创觉醒前：吸技能
      if (detail.scoreUpReference !== undefined) {
        const dd = { ...deckSkill }
        dd.hasScoreUpReference = true
        dd.scoreUpReferenceRate = detail.scoreUpReference.rate
        dd.scoreUpReferenceMax = Math.min(detail.scoreUpReference.max, scoreUpLimit - scoreUpSelfFixed)
        setter('ref', 1, 1, dd.scoreUpFixed + detail.scoreUpReference.max, dd)
      }

      // Bloom FES V家觉醒前：不同组合数量影响技能
      if (detail.scoreUpDifferentUnit !== undefined) {
        for (let i = 0; i <= 2; ++i) {
          const dd = { ...deckSkill }
          if (i > 0 && detail.scoreUpDifferentUnit.has(i)) {
            dd.scoreUpFixed += detail.scoreUpDifferentUnit.get(i)!
            dd.scoreUpFixed = Math.min(dd.scoreUpFixed, scoreUpLimit)
            dd.scoreUpToReference = dd.scoreUpFixed
          }
          setter('diff', i, 1, dd.scoreUpFixed, dd)
        }
      }
    }

    if (detailAfter !== undefined) {
      // 有双技能：花後存主 map，花前存 preTraining map
      fillSkill(detailAfter, (u, um, am, cv, v) => skillMap.setSkill(u, um, am, cv, v))
      fillSkill(detailBefore, (u, um, am, cv, v) => skillMap.setPreTrainingSkill(u, um, am, cv, v))
    } else {
      // 单技能：只存主 map
      fillSkill(detailBefore, (u, um, am, cv, v) => skillMap.setSkill(u, um, am, cv, v))
    }

    return skillMap
  }

  /**
   * 获取卡牌单个技能详情
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param afterTraining 是否为觉醒后技能
   */
  private async getSkillDetail (
    userCard: UserCard, card: Card, afterTraining: boolean
  ): Promise<SkillDetailInternal> {
    const skill = await this.getSkill(userCard, card, afterTraining)
    const characterRank = await this.getCharacterRank(card.characterId)

    const ret: SkillDetailInternal = {
      skillId: skill.id,
      isAfterTraining: afterTraining,
      scoreUpBasic: 0,
      scoreUpCharacterRank: 0,
      lifeRecovery: 0
    }

    for (const skillEffect of skill.skillEffects) {
      const skillEffectDetail = findOrThrow(skillEffect.skillEffectDetails,
        it => it.level === userCard.skillLevel)
      if (skillEffect.skillEffectType === 'score_up' ||
        skillEffect.skillEffectType === 'score_up_condition_life' ||
        skillEffect.skillEffectType === 'score_up_keep') {
        const current = skillEffectDetail.activateEffectValue
        // 组分特殊计算
        if (skillEffect.skillEnhance !== undefined) {
          ret.scoreUpSameUnit = {
            unit: skillEffect.skillEnhance.skillEnhanceCondition.unit,
            value: skillEffect.skillEnhance.activateEffectValue
          }
        }
        ret.scoreUpBasic = Math.max(ret.scoreUpBasic, current)
      } else if (skillEffect.skillEffectType === 'life_recovery') {
        ret.lifeRecovery += skillEffectDetail.activateEffectValue
      } else if (skillEffect.skillEffectType === 'score_up_character_rank') {
        if (skillEffect.activateCharacterRank !== undefined &&
            skillEffect.activateCharacterRank <= characterRank) {
          ret.scoreUpCharacterRank =
              Math.max(ret.scoreUpCharacterRank, skillEffectDetail.activateEffectValue)
        }
      } else if (skillEffect.skillEffectType === 'other_member_score_up_reference_rate') {
        ret.scoreUpReference = {
          rate: skillEffectDetail.activateEffectValue,
          max: skillEffectDetail.activateEffectValue2 ?? 0
        }
      } else if (skillEffect.skillEffectType === 'score_up_unit_count') {
        if (ret.scoreUpDifferentUnit === undefined) {
          ret.scoreUpDifferentUnit = new Map<number, number>()
        }
        if (skillEffect.activateUnitCount !== undefined) {
          ret.scoreUpDifferentUnit.set(skillEffect.activateUnitCount, skillEffectDetail.activateEffectValue)
        }
      }
    }
    return ret
  }

  /**
   * 获得技能（根据选择的觉醒状态）
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param afterTraining 是否为觉醒后
   */
  private async getSkill (userCard: UserCard, card: Card, afterTraining: boolean): Promise<Skill> {
    let skillId = card.skillId
    if (card.specialTrainingSkillId !== undefined && afterTraining) {
      skillId = card.specialTrainingSkillId
    }
    const skills = await this.dataProvider.getMasterData<Skill>('skills')
    return findOrThrow(skills, it => it.id === skillId)
  }

  /**
   * 获得角色等级
   * @param characterId 角色ID
   */
  private async getCharacterRank (characterId: number): Promise<number> {
    const userCharacters = await this.dataProvider.getUserData<UserCharacter[]>('userCharacters')
    const userCharacter =
      findOrThrow(userCharacters, it => it.characterId === characterId)
    return userCharacter.characterRank
  }
}

interface SkillDetailInternal {
  /** 技能ID */
  skillId: number
  /** 是否为觉醒后技能 */
  isAfterTraining: boolean
  /** 基础加分（不含下面各种加成） */
  scoreUpBasic: number
  /** 回血 */
  lifeRecovery: number
  /** 限定V家组分 */
  scoreUpSameUnit?: { unit: string, value: number }
  /** Bloom FES觉醒后：角色等级加成 */
  scoreUpCharacterRank: number
  /** Bloom FES原创角色觉醒前：吸其他人技能 */
  scoreUpReference?: { rate: number, max: number }
  /** Bloom FES V家觉醒前：按不同组合数额外加分 */
  scoreUpDifferentUnit?: Map<number, number>
}

export interface DeckCardSkillDetailPrepare {
  /** 技能ID */
  skillId: number
  /** 是否为觉醒后技能 */
  isAfterTraining: boolean
  /** 当前卡组中的固定加分（不含吸技能） */
  scoreUpFixed: number
  /** 被吸技能时的效果值 */
  scoreUpToReference: number
  /** 回血 */
  lifeRecovery: number
  /** 是否有吸技能 */
  hasScoreUpReference?: boolean
  /** 吸技能比例 */
  scoreUpReferenceRate?: number
  /** 吸技能效果最大值（不含基础加成） */
  scoreUpReferenceMax?: number
}
