import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type WorldBloomSupportDeckBonus } from '../master-data/world-bloom-support-deck-bonus'
import { type EventConfig } from './event-service'
import {
  type WorldBloomSupportDeckUnitEventLimitedBonus
} from '../master-data/world-bloom-support-deck-unit-event-limited-bonus'

const VIRTUAL_SINGER_MIN_ID = 21
const VIRTUAL_SINGER_MAX_ID = 26

export class CardBloomEventCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取单张卡牌的支援加成
   * 需要注意的是，普通World Link支援卡组只能上活动组合的卡，其它卡上不了（Finale为全卡）
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param units 卡牌对应组合
   * @param eventId 活动ID
   * @param worldBloomSupportUnit World Link支援团队
   * @param specialCharacterId 指定的加成角色（正常为篇章角色，Finale为队长角色）
   */
  public async getCardSupportDeckBonus (userCard: UserCard, card: Card, units: string[], {
    eventId = 0,
    worldBloomEventTurn,
    worldBloomSupportUnit,
    specialCharacterId = 0
  }: EventConfig): Promise<number | undefined> {
    // 未指定组合的话，不使用支援加成
    if (worldBloomSupportUnit === undefined) return undefined

    // 任何World Link都需要先判断一张卡牌是否是和支援角色组合（V家不看应援队伍）匹配，如果不是的话不使用支援加成
    const isVirtualSinger =
      card.characterId >= VIRTUAL_SINGER_MIN_ID && card.characterId <= VIRTUAL_SINGER_MAX_ID
    if (!isVirtualSinger && !units.includes(worldBloomSupportUnit)) {
      return undefined
    }

    // 获得稀有度对应的加成
    const worldBloomSupportDeckBonusKey =
      worldBloomEventTurn === 1
        ? 'worldBloomSupportDeckBonusesWL1'
        : worldBloomEventTurn === 2
          ? 'worldBloomSupportDeckBonusesWL2'
          : 'worldBloomSupportDeckBonusesWL3'
    let worldBloomSupportDeckBonuses =
      await this.dataProvider.getMasterData<WorldBloomSupportDeckBonus>(worldBloomSupportDeckBonusKey)
    if (worldBloomSupportDeckBonuses.length === 0) {
      worldBloomSupportDeckBonuses =
        await this.dataProvider.getMasterData<WorldBloomSupportDeckBonus>('worldBloomSupportDeckBonuses')
    }
    const bonus = findOrThrow(worldBloomSupportDeckBonuses,
      it => it.cardRarityType === card.cardRarityType)
    let total = 0

    // 角色加成
    const type =
      specialCharacterId > 0 && card.characterId === specialCharacterId ? 'specific' : 'others'
    total += findOrThrow(bonus.worldBloomSupportDeckCharacterBonuses,
      it => it.worldBloomSupportDeckCharacterType === type).bonusRate
    // 专精等级加成
    total += findOrThrow(bonus.worldBloomSupportDeckMasterRankBonuses,
      it => it.masterRank === userCard.masterRank).bonusRate
    // 技能等级加成
    total += findOrThrow(bonus.worldBloomSupportDeckSkillLevelBonuses,
      it => it.skillLevel === userCard.skillLevel).bonusRate

    // 4.5周年，新增了上一期WL卡牌额外加成
    // World Link Finale会加成上一年的组合限定卡
    const worldBloomSupportDeckUnitEventLimitedBonuses =
        await this.dataProvider.getMasterData<WorldBloomSupportDeckUnitEventLimitedBonus>('worldBloomSupportDeckUnitEventLimitedBonuses')
    const cardBonus = worldBloomSupportDeckUnitEventLimitedBonuses
      .find(it => it.eventId === eventId && it.gameCharacterId === specialCharacterId && it.cardId === card.id)
    if (cardBonus !== undefined) {
      total += cardBonus.bonusRate
    }
    return total
  }
}
