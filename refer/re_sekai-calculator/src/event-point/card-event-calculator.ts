import { type DataProvider } from '../data-provider/data-provider'
import { type Card } from '../master-data/card'
import { type EventDeckBonus } from '../master-data/event-deck-bonus'
import { type GameCharacterUnit } from '../master-data/game-character-unit'
import { findOrThrow } from '../util/collection-util'
import { type UserCard } from '../user-data/user-card'
import { type EventCard } from '../master-data/event-card'
import { type EventRarityBonusRate } from '../master-data/event-rarity-bonus-rate'
import { CardDetailMapEventBonus } from '../card-information/card-detail-map-event-bonus'
import type { UserHonor } from '../user-data/user-honor'
import { type EventHonorBonus } from '../master-data/event-honor-bonus'

export class CardEventCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取卡牌的角色、属性加成
   * @param eventId 活动ID
   * @param card 卡牌
   * @private
   */
  private async getEventDeckBonus (eventId: number, card: Card): Promise<number> {
    const eventDeckBonuses = await this.dataProvider.getMasterData<EventDeckBonus>('eventDeckBonuses')
    const gameCharacterUnits = await this.dataProvider.getMasterData<GameCharacterUnit>('gameCharacterUnits')
    return eventDeckBonuses.filter(it =>
      it.eventId === eventId &&
      (it.cardAttr === undefined || it.cardAttr === card.attr))
      .reduce((v, eventDeckBonus) => {
        // 无指定角色
        if (eventDeckBonus.gameCharacterUnitId === undefined) return Math.max(v, eventDeckBonus.bonusRate)

        const gameCharacterUnit = findOrThrow(gameCharacterUnits,
          unit => unit.id === eventDeckBonus.gameCharacterUnitId)

        // 角色不匹配
        if (gameCharacterUnit.gameCharacterId !== card.characterId) return v

        // 非虚拟歌手或者组合正确（或者无组合）的虚拟歌手，享受全量加成
        if (card.characterId < 21 || card.supportUnit === gameCharacterUnit.unit || card.supportUnit === 'none') {
          return Math.max(v, eventDeckBonus.bonusRate)
        }

        return v
      }, 0)
  }

  /**
   * 获取单一卡牌的活动加成（含角色、属性、当期、突破加成）
   * 返回值用到的时候还得/100
   * @param userCard 用户卡牌
   * @param eventId 活动ID
   */
  public async getCardEventBonus (userCard: UserCard, eventId: number): Promise<CardDetailMapEventBonus> {
    const cards = await this.dataProvider.getMasterData<Card>('cards')
    const eventCards = await this.dataProvider.getMasterData<EventCard>('eventCards')
    const eventRarityBonusRates = await this.dataProvider.getMasterData<EventRarityBonusRate>('eventRarityBonusRates')

    // 计算角色、属性加成
    const card = findOrThrow(cards, it => it.id === userCard.cardId)
    let fixedBonus = await this.getEventDeckBonus(eventId, card)

    // 计算突破等级加成
    const masterRankBonus = findOrThrow(eventRarityBonusRates,
      it => it.cardRarityType === card.cardRarityType && it.masterRank === userCard.masterRank)
    fixedBonus += masterRankBonus.bonusRate

    // 计算指定卡牌（正常是当期四星，World Link Finale为当年组合限定四星）加成
    // 为了给World Link Finale做指定卡牌加成上限，要单独加进返回结构，不能简单加算
    const cardBonus0 = eventCards
      .find((it: any) => it.eventId === eventId && it.cardId === card.id)
    const cardBonus = cardBonus0?.bonusRate ?? 0

    // 处理World Link Finale的Leader活动排名称号加成、Leader卡牌加成（因为和Leader位相关，要单独加进返回结构，不能简单加算）
    const leaderBonus =
        await this.getCardLeaderBonus(eventId, card.characterId, cardBonus0?.leaderBonusRate ?? 0)

    // 与卡组相关的内容要单独加进返回结构，不能简单加算
    const bonus = new CardDetailMapEventBonus()
    bonus.setBonus({
      fixedBonus,
      cardBonus,
      leaderBonus
    })
    return bonus
  }

  /**
   * 获得Leader称号加成、卡牌额外加成（World Link Finale）
   * @param eventId 活动ID
   * @param characterId 角色ID
   * @param cardLeaderBonus 卡牌的Leader额外加成
   * @private
   */
  private async getCardLeaderBonus (
    eventId: number, characterId: number, cardLeaderBonus: number
  ): Promise<number> {
    const eventHonorBonuses = await
    this.dataProvider.getMasterData<EventHonorBonus>('eventHonorBonuses')
    const bonuses = eventHonorBonuses
      .filter(it => it.eventId === eventId && it.leaderGameCharacterId === characterId)
    // 如果没有称号加成直接返回
    if (bonuses.length === 0) {
      return cardLeaderBonus
    }
    // 检查用户是否有特定称号
    const userHonors = await this.dataProvider.getUserData<UserHonor[]>('userHonors')
    return userHonors
      .map(honor => bonuses.find(it => it.honorId === honor.honorId))
      .filter(it => it !== undefined)
      .reduce((p, it) => p + (it?.bonusRate ?? 0), cardLeaderBonus)
  }
}

export interface CardEventBonusDetail {
  /**
   * 固定的加成，与卡组无关
   * 百分比，实际使用的时候还得/100
   */
  fixedBonus: number
  /**
   * 特定卡牌加成（正常是当期四星，World Link Finale为当年组合限定四星且有加成上限且不含Leader额外加成）
   * 百分比，实际使用的时候还得/100
   */
  cardBonus: number
  /**
   * World Link Finale的Leader活动排名称号加成、Leader额外卡牌加成（和Leader位相关）
   * 百分比，实际使用的时候还得/100
   */
  leaderBonus: number
}
