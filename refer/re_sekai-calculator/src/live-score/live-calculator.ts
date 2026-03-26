import { type DataProvider } from '../data-provider/data-provider'
import {
  DeckCalculator,
  type DeckDetail,
  type DeckCardDetail,
  type DeckCardSkillDetail
} from '../deck-information/deck-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { duplicateObj, findOrThrow } from '../util/collection-util'
import { type ScoreFunction } from '../deck-recommend/base-deck-recommend'
import { EventService } from '../event-point/event-service'

export class LiveCalculator {
  private readonly deckCalculator: DeckCalculator
  private readonly eventService: EventService

  public constructor (private readonly dataProvider: DataProvider) {
    this.deckCalculator = new DeckCalculator(dataProvider)
    this.eventService = new EventService(dataProvider)
  }

  /**
   * 获取歌曲数据
   * @param musicId 歌曲ID
   * @param musicDiff 歌曲难度
   */
  public async getMusicMeta (musicId: number, musicDiff: string): Promise<MusicMeta> {
    const musicMetas = await this.dataProvider.getMusicMeta()
    return findOrThrow(musicMetas, it => it.music_id === musicId && it.difficulty === musicDiff)
  }

  /**
   * 获得基础分数
   * @param musicMeta 歌曲数据
   * @param liveType Live类型
   * @private
   */
  private static getBaseScore (musicMeta: MusicMeta, liveType: LiveType): number {
    switch (liveType) {
      case LiveType.SOLO:
      case LiveType.CHALLENGE:
        return musicMeta.base_score
      case LiveType.MULTI:
      case LiveType.CHEERFUL:
        return musicMeta.base_score + musicMeta.fever_score * 0.5 // Fever加成50%
      case LiveType.AUTO:
        return musicMeta.base_score_auto
    }
  }

  /**
   * 获得技能分数
   * @param musicMeta 歌曲数据
   * @param liveType Live类型
   * @private
   */
  private static getSkillScore (musicMeta: MusicMeta, liveType: LiveType): number[] {
    switch (liveType) {
      case LiveType.SOLO:
      case LiveType.CHALLENGE:
        return musicMeta.skill_score_solo
      case LiveType.MULTI:
      case LiveType.CHEERFUL:
        return musicMeta.skill_score_multi
      case LiveType.AUTO:
        return musicMeta.skill_score_auto
    }
  }

  /**
   * 根据情况排序技能数据
   * @param deckDetail
   * @param liveType
   * @param skillDetails
   */
  private static getSortedSkillDetails (
    deckDetail: DeckDetail, liveType: LiveType, skillDetails: DeckCardSkillDetail[] | undefined = undefined
  ): { details: DeckCardSkillDetail[], sorted: boolean } {
    // 如果已经给定合法有效的技能数据，按给定的技能数据执行
    if (skillDetails !== undefined && skillDetails.length === 6 && skillDetails[5].scoreUp > 0) {
      return {
        details: skillDetails,
        sorted: false
      }
    }
    // 如果是多人联机，复制6次当前卡组的效果
    if (liveType === LiveType.MULTI) {
      return {
        details: duplicateObj(LiveCalculator.getMultiLiveSkill(deckDetail), 6),
        sorted: false
      }
    }

    // 单人，按效果正序排序技能
    const sortedSkill = [...deckDetail.cards].map(it => it.skill)
      .sort((a, b) => a.scoreUp - b.scoreUp)
    // 如果卡牌数量不足5张，中间技能需要留空
    const emptySkill = duplicateObj({
      scoreUp: 0,
      lifeRecovery: 0
    }, 5 - sortedSkill.length)
    // 将有效技能填充到前面、中间留空、第6个固定为C位
    return {
      details: [...sortedSkill, ...emptySkill, deckDetail.cards[0].skill],
      sorted: true
    }
  }

  /**
   * 根据情况排序技能实际效果
   * @param sorted 技能是否排序
   * @param cardLength 卡组卡牌数量
   * @param skillScores 原始技能效果
   * @private
   */
  private static getSortedSkillRate (sorted: boolean, cardLength: number, skillScores: number[]): number[] {
    // 如果技能未排序，原样返回
    if (!sorted) {
      return skillScores
    }
    // 按效果正序排序前cardLength个技能、中间和后面不动
    return [
      ...skillScores.slice(0, cardLength).sort((a, b) => a - b),
      ...skillScores.slice(cardLength)
    ]
  }

  /**
   * 根据给定的卡组和歌曲数据计算Live详情
   * @param deckDetail 卡组信息
   * @param musicMeta 歌曲数据
   * @param liveType Live类型
   * @param skillDetails 技能顺序（小于5后面技能留空、如果是多人需要放入加权后的累加值），如果留空则计算当前技能多人效果或最佳技能
   * @param multiPowerSum 多人队伍综合力总和（用于计算活跃加成，留空则使用5倍当前卡组综合力）
   */
  public static getLiveDetailByDeck (
    deckDetail: DeckDetail, musicMeta: MusicMeta, liveType: LiveType,
    skillDetails: DeckCardSkillDetail[] | undefined = undefined, multiPowerSum: number = 0
  ): LiveDetail {
    // 确定技能发动顺序，未指定则直接按效果排序或多人重复当前技能
    const skills = this.getSortedSkillDetails(deckDetail, liveType, skillDetails)
    // 与技能无关的分数比例
    const baseRate = LiveCalculator.getBaseScore(musicMeta, liveType)
    // 技能分数比例，如果是最佳技能计算则按加成排序（复制一下防止影响原数组顺序）
    const skillScores = [...LiveCalculator.getSkillScore(musicMeta, liveType)]
    const skillRate = LiveCalculator.getSortedSkillRate(skills.sorted, deckDetail.cards.length, skillScores)
    // 计算总的分数比例
    const rate = baseRate + skills.details
      .reduce((v, it, i) => v + it.scoreUp * skillRate[i] / 100, 0)
    const life = skills.details.reduce((v, it) => v + it.lifeRecovery, 0)
    // 活跃加分（按5次计算）
    const powerSum = multiPowerSum === 0 ? 5 * deckDetail.power.total : multiPowerSum
    const activeBonus = liveType === LiveType.MULTI ? 5 * LiveCalculator.getMultiActiveBonus(powerSum) : 0
    return {
      score: Math.floor(rate * deckDetail.power.total * 4 + activeBonus),
      time: musicMeta.music_time,
      life: Math.min(2000, life + 1000),
      tap: musicMeta.tap_count
    }
  }

  /**
   * 多人Live活跃加分（单次），1.5%的总综合力
   * 最多可以发动5次
   * @param powerSum 5个人的总综合
   */
  public static getMultiActiveBonus (powerSum: number): number {
    return 0.015 * powerSum
  }

  /**
   * 获得当前卡组在多人Live下的技能
   * @param deckDetail 卡组信息
   * @private
   */
  private static getMultiLiveSkill (deckDetail: DeckDetail): DeckCardSkillDetail {
    // 多人技能加分效果计算规则：C位100%发动、其他位置20%发动
    const scoreUp = deckDetail.cards.reduce((v, it, i) =>
      v + (i === 0 ? it.skill.scoreUp : (it.skill.scoreUp / 5)), 0)
    // 奶判只看C位
    const lifeRecovery = deckDetail.cards[0].skill.lifeRecovery
    return {
      scoreUp,
      lifeRecovery
    }
  }

  /**
   * 按给定顺序计算单人技能效果
   * @param liveSkills 技能顺序（可以小于6个）
   * @param skillDetails 卡组技能信息
   * @private
   */
  private static getSoloLiveSkill (
    liveSkills: LiveSkill[] | undefined, skillDetails: DeckCardDetail[]
  ): DeckCardSkillDetail[] | undefined {
    if (liveSkills === undefined) return undefined
    const skills = liveSkills.map(liveSkill => findOrThrow(skillDetails, it => it.cardId === liveSkill.cardId).skill)
    const ret: DeckCardSkillDetail[] = []
    // 因为可能会有技能空缺，先将无任何效果的技能放入6个位置
    for (let i = 0; i < 6; ++i) {
      ret.push({
        scoreUp: 0,
        lifeRecovery: 0
      })
    }
    // 将C位重复技能以外的技能分配到合适的位置
    for (let i = 0; i < skills.length - 1; ++i) {
      ret[i] = skills[i]
    }
    // 将C位重复技能固定放在最后
    ret[5] = skills[skills.length - 1]
    return ret
  }

  /**
   * 计算Live详情
   * @param deckCards 用户卡组中的用户卡牌
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   * @param liveSkills 技能顺序（多人或最佳留空）
   * @param eventId 活动ID（可选，用于World Link Final各种限制）
   */
  public async getLiveDetail (
    deckCards: UserCard[], musicMeta: MusicMeta, liveType: LiveType,
    liveSkills: LiveSkill[] | undefined = undefined, eventId?: number
  ): Promise<LiveDetail> {
    const eventConfig = eventId === undefined
      ? undefined
      : await this.eventService.getEventConfig(eventId)
    const deckDetail = await this.deckCalculator.getDeckDetail(deckCards, deckCards, eventConfig)
    // 如果给定了顺序就按顺序发动，没有的话就按最优发动
    const skills = liveType === LiveType.MULTI
      ? undefined
      : LiveCalculator.getSoloLiveSkill(liveSkills, deckDetail.cards)
    const ret = LiveCalculator.getLiveDetailByDeck(deckDetail, musicMeta, liveType, skills)
    ret.deck = deckDetail // 附加上卡组信息，方便debug
    return ret
  }

  /**
   * 获取卡组Live分数
   * @param deckDetail 卡组
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   */
  public static getLiveScoreByDeck (
    deckDetail: DeckDetail, musicMeta: MusicMeta, liveType: LiveType
  ): number {
    return LiveCalculator.getLiveDetailByDeck(deckDetail, musicMeta, liveType).score
  }

  /**
   * 获取计算歌曲分数的函数
   * @param liveType Live类型
   */
  public static getLiveScoreFunction (liveType: LiveType): ScoreFunction {
    return (musicMeta, deckDetail) =>
      LiveCalculator.getLiveScoreByDeck(deckDetail, musicMeta, liveType)
  }
}

export interface LiveDetail {
  score: number
  time: number
  life: number
  tap: number
  deck?: DeckDetail
}

export interface LiveSkill {
  seq?: number
  cardId: number
}

export enum LiveType {
  SOLO = 'solo',
  AUTO = 'auto',
  CHALLENGE = 'challenge',
  MULTI = 'multi',
  CHEERFUL = 'cheerful',
}
