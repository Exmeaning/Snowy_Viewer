import { type Card } from '../master-data/card'
import { type GameCharacter } from '../master-data/game-character'
import { findOrThrow } from '../util/collection-util'
import { type UserCard } from '../user-data/user-card'
import { type CardRarity } from '../master-data/card-rarity'
import { type CardConfig } from './card-calculator'
import { type DataProvider } from '../data-provider/data-provider'

export class CardService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获得卡牌组合信息（包括原始组合与应援组合）
   * @param card 卡牌
   * @private
   */
  public async getCardUnits (card: Card): Promise<string[]> {
    const gameCharacters = await this.dataProvider.getMasterData<GameCharacter>('gameCharacters')
    // 组合（V家支援组合、角色原始组合）
    const units = [] as string[]
    if (card.supportUnit !== 'none') units.push(card.supportUnit)
    units.push(findOrThrow(gameCharacters, it => it.id === card.characterId).unit)
    return units
  }

  /**
   * 应用卡牌设置
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param cardRarities 卡牌稀有度
   * @param rankMax 强制满级
   * @param episodeRead 强制前后篇
   * @param masterMax 强制满破
   * @param skillMax 强制满技能
   * @private
   */
  public async applyCardConfig (
    userCard: UserCard, card: Card, {
      rankMax = false,
      episodeRead = false,
      masterMax = false,
      skillMax = false
    }: CardConfig = {}
  ): Promise<UserCard> {
    // 都按原样，那就什么都无需调整
    if (!rankMax && !episodeRead && !masterMax && !skillMax) return userCard

    const cardRarities = await this.dataProvider.getMasterData<CardRarity>('cardRarities')
    const cardRarity = findOrThrow(cardRarities, it => it.cardRarityType === card.cardRarityType)
    // 深拷贝一下原始对象，避免污染
    const ret = JSON.parse(JSON.stringify(userCard)) as UserCard

    // 处理最大等级
    if (rankMax) {
      // 是否可以觉醒
      if (cardRarity.trainingMaxLevel !== undefined) {
        ret.level = cardRarity.trainingMaxLevel
        ret.specialTrainingStatus = 'done'
      } else {
        ret.level = cardRarity.maxLevel
      }
    }

    // 处理前后篇解锁
    if (episodeRead && ret.episodes !== undefined) {
      ret.episodes.forEach(it => {
        it.scenarioStatus = 'already_read'
      })
    }

    // 突破
    if (masterMax) {
      ret.masterRank = 5
    }

    // 技能
    if (skillMax) {
      ret.skillLevel = cardRarity.maxSkillLevel
    }
    return ret
  }
}
