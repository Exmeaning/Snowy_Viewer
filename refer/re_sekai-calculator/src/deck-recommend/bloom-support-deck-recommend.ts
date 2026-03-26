import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardDetail } from '../card-information/card-calculator'
import { type UserCard } from '../user-data/user-card'
import { EventCalculator } from '../event-point/event-calculator'
import { EventService } from '../event-point/event-service'

export class BloomSupportDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly eventService: EventService
  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.eventService = new EventService(dataProvider)
  }

  /**
   * 推荐支援卡组
   * @param mainDeck 主要卡组
   * @param eventId 活动ID
   * @param specialCharacterId 支援角色
   */
  public async recommendBloomSupportDeck (
    mainDeck: Array<{ cardId: number }>, eventId: number, specialCharacterId: number
  ): Promise<CardDetail[]> {
    const userCards = await this.dataProvider.getUserData<UserCard[]>('userCards')
    const eventConfig = await this.eventService.getEventConfig(eventId, specialCharacterId)
    const allCards =
      await this.cardCalculator.batchGetCardDetail(userCards, {}, eventConfig)
    return EventCalculator.getSupportDeckBonus(mainDeck, allCards).cards
  }
}
