import { type DataProvider } from '../data-provider/data-provider'
import { LiveCalculator, LiveType } from '../live-score/live-calculator'
import { type MusicMeta } from '../common/music-meta'
import { DeckCalculator, type DeckDetail } from '../deck-information/deck-calculator'
import { EventCalculator } from '../event-point/event-calculator'
import { EventType } from '../event-point/event-service'

export class MusicRecommend {
  private readonly deckCalculator: DeckCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 获取一首歌曲的分数、活动PT
   * @param deck 卡组
   * @param musicMeta 歌曲信息
   * @param liveType 计算的Live类型
   * @param eventType 活动类型
   * @private
   */
  private getRecommendMusic (
    deck: DeckDetail, musicMeta: MusicMeta, liveType: LiveType, eventType: EventType
  ): RecommendMusic {
    const liveScore = new Map<LiveType, number>()
    const eventPoint = new Map<LiveType, number>()
    const deckBonus = deck.eventBonus
    const score = LiveCalculator.getLiveDetailByDeck(deck, musicMeta, liveType).score
    liveScore.set(liveType, score)
    // 挑战Live或者有计算加成的话，就算一下活动PT
    if (deck.eventBonus !== undefined || liveType === LiveType.CHALLENGE) {
      const point = EventCalculator.getEventPoint(liveType, eventType, score, musicMeta.event_rate, deckBonus)
      eventPoint.set(liveType, point)
    }

    return {
      musicId: musicMeta.music_id,
      difficulty: musicMeta.difficulty,
      liveScore,
      eventPoint
    }
  }

  /**
   * 根据卡组，获取歌曲分数与活动PT
   * @param deck 卡组
   * @param liveType 计算的Live类型
   * @param eventType 活动类型
   */
  public async recommendMusic (
    deck: DeckDetail, liveType: LiveType, eventType: EventType = EventType.NONE
  ): Promise<RecommendMusic[]> {
    const musicMetas = await this.dataProvider.getMusicMeta()
    return musicMetas.map(it => this.getRecommendMusic(deck, it, liveType, eventType))
  }
}

interface RecommendMusic {
  musicId: number
  difficulty: string
  liveScore: Map<LiveType, number>
  eventPoint: Map<LiveType, number>
}
