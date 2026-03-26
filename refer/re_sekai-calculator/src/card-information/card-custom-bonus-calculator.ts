import { type Card } from '../master-data/card'
import { type CustomBonusConfig, type CustomBonusRule } from '../common/custom-bonus'
import { CardDetailMapEventBonus } from './card-detail-map-event-bonus'

const UNIT_ALIAS_MAP: Record<string, string> = {
  any: 'any',
  none: 'none',
  leo_need: 'leo_need',
  light_sound: 'leo_need',
  more_more_jump: 'more_more_jump',
  idol: 'more_more_jump',
  vivid_bad_squad: 'vivid_bad_squad',
  street: 'vivid_bad_squad',
  wonderlands_showtime: 'wonderlands_showtime',
  theme_park: 'wonderlands_showtime',
  nightcord_at_25: 'nightcord_at_25',
  school_refusal: 'nightcord_at_25',
  piapro: 'piapro'
}

/**
 * 自定义加成计算器
 * 根据用户配置的自定义加成规则，为卡牌计算额外的活动加成
 */
export class CardCustomBonusCalculator {
  /**
   * 计算卡牌匹配的自定义加成总和
   * @param card 卡牌主数据
   * @param customBonuses 自定义加成配置
   * @returns 匹配的加成百分比总和
   */
  public static getCustomBonusRate (card: Card, customBonuses: CustomBonusConfig): number {
    let totalBonus = 0
    for (const rule of customBonuses.rules) {
      if (CardCustomBonusCalculator.matchRule(card, rule)) {
        totalBonus += rule.bonusRate
      }
    }
    return totalBonus
  }

  /**
   * 统一团体命名（兼容旧命名与新命名）
   */
  private static normalizeUnitName (unit: string): string {
    return UNIT_ALIAS_MAP[unit] ?? unit
  }

  /**
   * 判断卡牌是否匹配某条自定义加成规则
   */
  private static matchRule (card: Card, rule: CustomBonusRule): boolean {
    const normalizedCardSupportUnit = CardCustomBonusCalculator.normalizeUnitName(card.supportUnit)

    // 如果指定了 characterId，精确匹配
    if (rule.characterId !== undefined) {
      if (card.characterId !== rule.characterId) return false
      // 属性匹配
      if (rule.attr !== undefined && rule.attr !== 'any' && rule.attr !== card.attr) return false
      // 虚拟歌手的 supportUnit 匹配
      if (rule.supportUnit !== undefined && rule.supportUnit !== 'any') {
        const normalizedRuleSupportUnit = CardCustomBonusCalculator.normalizeUnitName(rule.supportUnit)
        if (normalizedRuleSupportUnit !== normalizedCardSupportUnit) return false
      }
      return true
    }

    // 属性匹配
    if (rule.attr !== undefined && rule.attr !== 'any' && rule.attr !== card.attr) return false

    // 组合匹配
    const normalizedRuleUnit = CardCustomBonusCalculator.normalizeUnitName(rule.unit)
    if (normalizedRuleUnit !== 'any') {
      const isVirtualSinger = card.characterId >= 21 && card.characterId <= 26

      if (normalizedRuleUnit === 'piapro') {
        // 匹配虚拟歌手
        if (!isVirtualSinger) return false
        // 检查应援组合
        if (rule.supportUnit !== undefined && rule.supportUnit !== 'any') {
          const normalizedRuleSupportUnit = CardCustomBonusCalculator.normalizeUnitName(rule.supportUnit)
          if (normalizedRuleSupportUnit !== normalizedCardSupportUnit) return false
        }
      } else {
        // 匹配原创角色组合
        if (isVirtualSinger) {
          // 虚拟歌手通过 supportUnit 匹配
          // 原版虚拟歌手（supportUnit='none'）视为万金油，匹配任何团体
          if (normalizedCardSupportUnit !== normalizedRuleUnit && normalizedCardSupportUnit !== 'none') return false
        } else {
          // 原创角色：需要通过 characterId 范围判断组合
          // characterId 1-4: leo_need, 5-8: more_more_jump, 9-12: vivid_bad_squad,
          // 13-16: wonderlands_showtime, 17-20: nightcord_at_25
          const unitForCharacter = CardCustomBonusCalculator.getUnitByCharacterId(card.characterId)
          const normalizedCharacterUnit = CardCustomBonusCalculator.normalizeUnitName(unitForCharacter)
          if (normalizedCharacterUnit !== normalizedRuleUnit) return false
        }
      }
    }

    return true
  }

  /**
   * 根据角色ID推断所属组合
   * @param characterId 角色ID (1-20为原创角色)
   */
  private static getUnitByCharacterId (characterId: number): string {
    if (characterId >= 1 && characterId <= 4) return 'leo_need'
    if (characterId >= 5 && characterId <= 8) return 'more_more_jump'
    if (characterId >= 9 && characterId <= 12) return 'vivid_bad_squad'
    if (characterId >= 13 && characterId <= 16) return 'wonderlands_showtime'
    if (characterId >= 17 && characterId <= 20) return 'nightcord_at_25'
    return 'piapro'
  }

  /**
   * 将自定义加成应用到卡牌的活动加成上
   * 如果原本没有活动加成（无活动），则创建一个仅包含自定义加成的 EventBonus
   * 如果原本有活动加成，则将自定义加成叠加到 fixedBonus 上
   *
   * @param existingBonus 现有的活动加成（可能为 undefined）
   * @param card 卡牌主数据
   * @param customBonuses 自定义加成配置
   * @returns 应用了自定义加成后的活动加成
   */
  public static applyCustomBonus (
    existingBonus: CardDetailMapEventBonus | undefined,
    card: Card,
    customBonuses: CustomBonusConfig
  ): CardDetailMapEventBonus | undefined {
    const customRate = CardCustomBonusCalculator.getCustomBonusRate(card, customBonuses)
    if (customRate === 0 && existingBonus === undefined) return undefined

    if (existingBonus !== undefined) {
      // 叠加到现有加成
      if (customRate === 0) return existingBonus
      const bonus = existingBonus.getBonus()
      const newBonus = new CardDetailMapEventBonus()
      newBonus.setBonus({
        fixedBonus: bonus.fixedBonus + customRate,
        cardBonus: bonus.cardBonus,
        leaderBonus: bonus.leaderBonus
      })
      return newBonus
    } else {
      // 无活动时，创建仅包含自定义加成的 EventBonus
      if (customRate === 0) return undefined
      const newBonus = new CardDetailMapEventBonus()
      newBonus.setBonus({
        fixedBonus: customRate,
        cardBonus: 0,
        leaderBonus: 0
      })
      return newBonus
    }
  }
}
