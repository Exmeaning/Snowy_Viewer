import { type DataProvider } from '../data-provider/data-provider'
import { BaseDeckRecommend, type DeckRecommendConfig, type RecommendDeck } from './base-deck-recommend'
import { type UserCard } from '../user-data/user-card'
import { type LiveType } from '../live-score/live-calculator'
import { EventCalculator } from '../event-point/event-calculator'
import { EventService } from '../event-point/event-service'

export class EventDeckRecommend {
  private readonly baseRecommend: BaseDeckRecommend
  private readonly eventService: EventService

  public constructor (private readonly dataProvider: DataProvider) {
    this.baseRecommend = new BaseDeckRecommend(dataProvider)
    this.eventService = new EventService(dataProvider)
  }

  /**
   * 推荐活动用的卡牌
   * 根据活动PT高低推荐
   * @param eventId 活动ID
   * @param liveType Live类型
   * @param config 推荐设置
   * @param specialCharacterId 指定的角色（用于世界开花活动支援卡组）
   */
  public async recommendEventDeck (
    eventId: number, liveType: LiveType, config: DeckRecommendConfig, specialCharacterId: number = 0
  ): Promise<RecommendDeck[]> {
    const eventConfig = await this.eventService.getEventConfig(eventId, specialCharacterId)
    if (eventConfig.eventType === undefined) throw new Error(`Event type not found for ${eventId}`)
    const userCards = await this.dataProvider.getUserData<UserCard[]>('userCards')
    return await this.baseRecommend.recommendHighScoreDeck(userCards,
      EventCalculator.getEventPointFunction(liveType, eventConfig.eventType), config, liveType, eventConfig)
  }
}
