import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardConfig, type CardDetail } from '../card-information/card-calculator'
import {
  DeckCalculator,
  SkillReferenceChooseStrategy,
  type DeckDetail
} from '../deck-information/deck-calculator'
import { LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { containsAny, swap } from '../util/collection-util'
import { filterCardPriority } from '../card-priority/card-priority-filter'
import { isDeckAttrLessThan3, toRecommendDeck, updateDeck } from './deck-result-update'
import { AreaItemService } from '../area-item-information/area-item-service'
import { type EventConfig, EventType } from '../event-point/event-service'
import { findBestCardsGA, type GAConfig } from './find-best-cards-ga'

/** 推荐算法类型 */
export enum RecommendAlgorithm {
  /** 深度优先搜索（精确但慢） */
  DFS = 'dfs',
  /** 遗传算法（快速近似） */
  GA = 'ga'
}

/** 推荐优化目标 */
export enum RecommendTarget {
  /** 分数最高 */
  Score = 'score',
  /** 综合力最高 */
  Power = 'power',
  /** 技能实效最高 */
  Skill = 'skill',
  /** 指定活动加成 */
  Bonus = 'bonus',
  /** 烤森活动点数最高 */
  Mysekai = 'mysekai'
}

export class BaseDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator
  private readonly areaItemService: AreaItemService

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
    this.areaItemService = new AreaItemService(dataProvider)
  }

  /**
   * 使用递归寻找最佳卡组（DFS）
   * 栈深度不超过member+1层
   * 复杂度O(n^member)，带大量剪枝和超时控制
   * 参考 C++ 库 (NeuraXmy/sekai-deck-recommend-cpp) 的 fixedCards/fixedCharacters 剪枝策略
   */
  private static findBestCardsDFS (
    cardDetails: CardDetail[], allCards: CardDetail[], scoreFunc: (deckDetail: DeckDetail) => number, limit: number = 1,
    isChallengeLive: boolean = false, member: number = 5, leaderCharacter: number = 0, honorBonus: number = 0,
    eventConfig: EventConfig = {},
    skillReferenceChooseStrategy: SkillReferenceChooseStrategy = SkillReferenceChooseStrategy.Average,
    keepAfterTrainingState: boolean = false,
    bestSkillAsLeader: boolean = true,
    deckCards: CardDetail[] = [],
    dfsState?: DFSState,
    fixedCharacters: number[] = [],
    fixedCards: CardDetail[] = []
  ): RecommendDeck[] {
    // 超时检查
    if (dfsState !== undefined && dfsState.isTimeout()) {
      return dfsState.bestDecks
    }

    // 防止挑战Live卡的数量小于允许上场的数量导致无法组队
    if (isChallengeLive) {
      member = Math.min(member, cardDetails.length)
    }

    // 固定卡牌/角色不参与剪枝的起始位置（参考 C++ 的 cIndex）
    const cIndex = fixedCards.length + fixedCharacters.length

    // 如果 deckCards 为空且有固定卡牌，先插入固定卡牌
    if (deckCards.length === 0 && fixedCards.length > 0) {
      deckCards = [...fixedCards]
    }

    // 已经是完整卡组，计算当前卡组的值
    if (deckCards.length === member) {
      // 检查 hash 缓存
      if (dfsState !== undefined) {
        const hash = BaseDeckRecommend.calcDeckHash(deckCards)
        if (dfsState.deckHashCache.has(hash)) {
          return dfsState.bestDecks
        }
        dfsState.deckHashCache.add(hash)
      }

      // 如果有固定角色/卡牌，不调整C位，直接评估
      if (fixedCharacters.length > 0 || fixedCards.length > 0) {
        const deckDetail = DeckCalculator.getDeckDetailByCards(
          deckCards, allCards, honorBonus, eventConfig.cardBonusCountLimit,
          eventConfig.worldBloomDifferentAttributeBonuses,
          skillReferenceChooseStrategy, keepAfterTrainingState, false,
          eventConfig.worldBloomEventTurn
        )
        const score = scoreFunc(deckDetail)
        return toRecommendDeck(deckDetail, score)
      }

      // 无固定角色时：双策略选C位，取更高分
      // 策略A：按技能选C位（原始逻辑）
      const dd1 = DeckCalculator.getDeckDetailByCards(
        deckCards, allCards, honorBonus, eventConfig.cardBonusCountLimit,
        eventConfig.worldBloomDifferentAttributeBonuses,
        skillReferenceChooseStrategy, keepAfterTrainingState, true,
        eventConfig.worldBloomEventTurn
      )
      const s1 = scoreFunc(dd1)

      // 策略B：按 leaderBonus 最高的卡作为C位
      let bestLeaderIdx = 0
      let bestLeaderBonus = -1
      for (let i = 0; i < deckCards.length; i++) {
        const card = deckCards[i]
        const lb = card.eventBonus !== undefined
          ? card.eventBonus.getMaxBonus(true) - card.eventBonus.getMaxBonus(false)
          : 0
        if (lb > bestLeaderBonus) {
          bestLeaderBonus = lb
          bestLeaderIdx = i
        }
      }

      let s2 = -1
      let dd2: DeckDetail | null = null
      if (bestLeaderIdx !== 0 && bestLeaderBonus > 0) {
        swap(deckCards, 0, bestLeaderIdx)
        dd2 = DeckCalculator.getDeckDetailByCards(
          deckCards, allCards, honorBonus, eventConfig.cardBonusCountLimit,
          eventConfig.worldBloomDifferentAttributeBonuses,
          skillReferenceChooseStrategy, keepAfterTrainingState, false,
          eventConfig.worldBloomEventTurn
        )
        s2 = scoreFunc(dd2)
        swap(deckCards, 0, bestLeaderIdx) // 恢复
      }

      const bestScore = s2 > s1 ? s2 : s1
      const bestDetail = (s2 > s1 && dd2 !== null) ? dd2 : dd1
      return toRecommendDeck(bestDetail, bestScore)
    }
    // 非完整卡组，继续遍历所有情况
    let ans: RecommendDeck[] = []
    let preCard: CardDetail | null = null
    for (const card of cardDetails) {
      // 超时检查
      if (dfsState !== undefined && dfsState.isTimeout()) {
        return ans.length > 0 ? ans : dfsState.bestDecks
      }

      // 跳过已经重复出现过的卡牌
      if (deckCards.some(it => it.cardId === card.cardId)) {
        continue
      }
      // 跳过重复角色
      if (!isChallengeLive && deckCards.some(it => it.characterId === card.characterId)) {
        continue
      }
      // 强制角色限制：fixedCharacters 按位置匹配（参考 C++ 的 fixedCharacters 逻辑）
      if (fixedCharacters.length > deckCards.length && fixedCharacters[deckCards.length] !== card.characterId) {
        continue
      }
      // C位相关优化：固定卡牌/角色不参与剪枝（参考 C++ 的 cIndex 策略）
      // C位一定是技能最好的卡牌，跳过技能比C位还好的
      if (deckCards.length >= cIndex + 1 && deckCards[cIndex].skill.isCertainlyLessThen(card.skill)) {
        continue
      }
      // 为了优化性能，必须和C位同色或同组（从 cIndex 位置开始判断）
      if (deckCards.length >= cIndex + 1 && card.attr !== deckCards[cIndex].attr && !containsAny(deckCards[cIndex].units, card.units)) {
        continue
      }
      // 为了优化性能，如果是World Link活动，强制3色及以上
      if (eventConfig.worldBloomDifferentAttributeBonuses !== undefined && isDeckAttrLessThan3(deckCards, card)) {
        continue
      }
      // 要求生成的卡组后面位置按强弱排序、同强度按卡牌ID排序
      // 从 cIndex + 2 位置开始启用排序剪枝（固定位置不参与排序）
      const sortPruneStart = cIndex + 2
      if (deckCards.length >= sortPruneStart && CardCalculator.isCertainlyLessThan(deckCards[deckCards.length - 1], card)) {
        continue
      }
      if (deckCards.length >= sortPruneStart && !CardCalculator.isCertainlyLessThan(card, deckCards[deckCards.length - 1]) &&
        card.cardId < deckCards[deckCards.length - 1].cardId) {
        continue
      }
      // 如果肯定比上一次选定的卡牌要弱，那么舍去
      if (deckCards.length >= cIndex && preCard !== null && CardCalculator.isCertainlyLessThan(card, preCard)) {
        continue
      }
      preCard = card
      // 递归
      const result = BaseDeckRecommend.findBestCardsDFS(
        cardDetails, allCards, scoreFunc, limit, isChallengeLive, member, leaderCharacter, honorBonus,
        eventConfig, skillReferenceChooseStrategy, keepAfterTrainingState, bestSkillAsLeader,
        [...deckCards, card], dfsState, fixedCharacters, fixedCards)
      ans = updateDeck(ans, result, limit)
      // 更新 dfsState 中的最佳结果，确保超时时能返回部分结果
      if (dfsState !== undefined && ans.length > 0) {
        dfsState.bestDecks = updateDeck(dfsState.bestDecks, ans, limit)
      }
    }
    // 在最外层检查一下是否成功组队
    if (deckCards.length === 0 && ans.length === 0) {
      // 超时时返回已找到的最佳结果
      if (dfsState !== undefined && dfsState.bestDecks.length > 0) {
        return dfsState.bestDecks
      }
      console.warn(`Cannot find deck in ${cardDetails.length} cards(${cardDetails.map(it => it.cardId).toString()})`)
      return []
    }
    return ans
  }

  /** 计算卡组哈希（用于去重缓存） */
  private static calcDeckHash (deckCards: CardDetail[]): number {
    if (deckCards.length === 0) return 0
    const ids = deckCards.map(c => c.cardId)
    const sorted = ids.slice(1).sort((a, b) => a - b)
    const BASE = 10007
    let hash = ids[0]
    for (const id of sorted) {
      hash = ((hash * BASE) + id) | 0
    }
    return hash >>> 0
  }

  /**
   * 推荐高分卡组
   */
  public async recommendHighScoreDeck (
    userCards: UserCard[], scoreFunc: ScoreFunction,
    {
      musicMeta,
      limit = 1,
      member = 5,
      leaderCharacter = undefined,
      fixedCards: configFixedCards = [],
      fixedCharacters: configFixedCharacters = [],
      cardConfig = {},
      debugLog = (_: string) => {
      },
      algorithm = RecommendAlgorithm.GA,
      gaConfig = {},
      timeoutMs = 30000,
      target = RecommendTarget.Score,
      skillReferenceChooseStrategy = SkillReferenceChooseStrategy.Average,
      keepAfterTrainingState = false,
      bestSkillAsLeader = true
    }: DeckRecommendConfig,
    liveType: LiveType,
    eventConfig: EventConfig = {}
  ): Promise<RecommendDeck[]> {
    const { eventType = EventType.NONE, eventUnit, specialCharacterId, worldBloomType, worldBloomSupportUnit } = eventConfig

    // 向后兼容：将 leaderCharacter 转换为 fixedCharacters
    let fixedCharacters = [...configFixedCharacters]
    if (fixedCharacters.length === 0 && leaderCharacter !== undefined && leaderCharacter > 0) {
      fixedCharacters = [leaderCharacter]
    }

    // 暂不支持同时指定固定卡牌和固定角色
    if (configFixedCards.length > 0 && fixedCharacters.length > 0) {
      throw new Error('Cannot set both fixedCards and fixedCharacters')
    }
    // 挑战live不允许指定固定角色
    if (liveType === LiveType.CHALLENGE && fixedCharacters.length > 0) {
      throw new Error('Cannot set fixedCharacters in challenge live')
    }

    // 根据推荐目标覆盖 scoreFunc
    let effectiveScoreFunc = scoreFunc
    if (target === RecommendTarget.Power) {
      effectiveScoreFunc = (_musicMeta, deckDetail) => deckDetail.power.total
    } else if (target === RecommendTarget.Skill) {
      effectiveScoreFunc = (_musicMeta, deckDetail) => deckDetail.multiLiveScoreUp * 10000 + deckDetail.power.total
    }

    const honorBonus = await this.deckCalculator.getHonorBonusPower()
    const areaItemLevels = await this.areaItemService.getAreaItemLevels()
    let cards =
        await this.cardCalculator.batchGetCardDetail(userCards, cardConfig, eventConfig, areaItemLevels)

    // 过滤箱活（World Bloom）的卡，不上其它组合的
    // 只在 World Bloom 活动中过滤，马拉松/嘉年华活动不过滤（非活动团体的高综合力卡可能产生更高PT）
    let filterUnit: string | undefined
    if (eventType === EventType.BLOOM) {
      filterUnit = worldBloomSupportUnit ?? eventUnit
    }
    // 构建固定角色ID集合（用于箱活过滤豁免）
    const fixedCharacterSet = new Set(fixedCharacters)
    if (filterUnit !== undefined) {
      const originCardsLength = cards.length
      cards = cards.filter(it =>
        (it.units.length === 1 && it.units[0] === 'piapro') ||
          it.units.includes(filterUnit) ||
          fixedCharacterSet.has(it.characterId))
      debugLog(`Cards filtered with unit ${filterUnit}: ${cards.length}/${originCardsLength}`)
      debugLog(cards.map(it => it.cardId).toString())
    }

    // 获取固定卡牌的 CardDetail（参考 C++ 库的虚拟卡牌生成逻辑）
    const resolvedFixedCards: CardDetail[] = []
    for (const cardId of configFixedCards) {
      const existing = cards.find(c => c.cardId === cardId)
      if (existing !== undefined) {
        resolvedFixedCards.push(existing)
      } else {
        // 找不到的情况下，生成一个初始养成情况的虚拟卡牌
        const virtualUserCard: UserCard = {
          userId: 0,
          cardId,
          level: 1,
          exp: 0,
          totalExp: 0,
          skillLevel: 1,
          skillExp: 0,
          totalSkillExp: 0,
          masterRank: 0,
          specialTrainingStatus: 'not_doing',
          defaultImage: 'original',
          duplicateCount: 0,
          createdAt: 0,
          episodes: []
        }
        const virtualCards = await this.cardCalculator.batchGetCardDetail(
          [virtualUserCard], cardConfig, eventConfig, areaItemLevels
        )
        if (virtualCards.length > 0) {
          resolvedFixedCards.push(virtualCards[0])
          cards.push(virtualCards[0])
          debugLog(`Generated virtual card for fixed cardId=${cardId}`)
        } else {
          debugLog(`Warning: Failed to generate virtual card for fixed cardId=${cardId}, skipping`)
        }
      }
    }

    // 检查固定卡牌是否有效
    if (resolvedFixedCards.length > 0) {
      if (resolvedFixedCards.length > member) {
        throw new Error('Fixed cards size is larger than member size')
      }
      const fixedCardIds = new Set(resolvedFixedCards.map(c => c.cardId))
      if (fixedCardIds.size !== resolvedFixedCards.length) {
        throw new Error('Fixed cards have duplicate cards')
      }
      if (liveType !== LiveType.CHALLENGE) {
        const fixedCardCharacterIds = new Set(resolvedFixedCards.map(c => c.characterId))
        if (fixedCardCharacterIds.size !== resolvedFixedCards.length) {
          throw new Error('Fixed cards have duplicate characters')
        }
      }
    }

    // World Link Finale，需要强制指定Leader
    if (worldBloomType === 'finale' && specialCharacterId !== undefined) {
      fixedCharacters = [specialCharacterId]
    }

    // 为 DFS/GA 传递的 leaderCharacter 兼容值（取第一个固定角色，或 0）
    const effectiveLeaderCharacter = fixedCharacters.length > 0 ? fixedCharacters[0] : 0

    // 卡牌按强度降序排序（参考 C++ 库 base-deck-recommend.cpp:260-271）
    // 使用 max/min 全序比较，而非 isCertainlyLessThan 偏序，确保排序稳定
    const sortCardsByStrength = (cardList: CardDetail[]): CardDetail[] => {
      return [...cardList].sort((a, b) => {
        if (target === RecommendTarget.Skill) {
          // 技能优先：(max desc, min desc, cardId desc)
          const aMax = a.skill.getMax(); const bMax = b.skill.getMax()
          if (aMax !== bMax) return bMax - aMax
          const aMin = a.skill.getMin(); const bMin = b.skill.getMin()
          if (aMin !== bMin) return bMin - aMin
          return b.cardId - a.cardId
        } else {
          // 综合力优先：(max desc, min desc, cardId desc)
          const aMax = a.power.getMax(); const bMax = b.power.getMax()
          if (aMax !== bMax) return bMax - aMax
          const aMin = a.power.getMin(); const bMin = b.power.getMin()
          if (aMin !== bMin) return bMin - aMin
          return b.cardId - a.cardId
        }
      })
    }

    const startTime = Date.now()
    const isTimeout = (): boolean => Date.now() - startTime > timeoutMs

    // 如果使用 GA 算法
    if (algorithm === RecommendAlgorithm.GA) {
      debugLog(`Using GA algorithm with ${cards.length} cards`)

      // GA 用全部卡牌搜索（参考 C++ 库：GA 不使用 filterCardPriority）
      const gaResult = findBestCardsGA(
        cards, cards, effectiveScoreFunc, musicMeta, limit,
        liveType === LiveType.CHALLENGE, member, honorBonus, eventConfig,
        { ...gaConfig, timeoutMs: Math.max(1000, timeoutMs - (Date.now() - startTime)), target },
        skillReferenceChooseStrategy, keepAfterTrainingState, bestSkillAsLeader,
        effectiveLeaderCharacter, fixedCharacters, resolvedFixedCards
      )

      if (gaResult.length >= limit) {
        debugLog(`GA found ${gaResult.length} deck(s)`)
        return gaResult
      }

      // GA 结果不足，fallback 到 DFS
      debugLog(`GA found ${gaResult.length} deck(s), falling back to DFS`)
      if (isTimeout()) return gaResult

      // 用 DFS 补充
      let preCardDetails = [] as CardDetail[]
      while (!isTimeout()) {
        const cardDetails =
            filterCardPriority(liveType, eventType, cards, preCardDetails, member, effectiveLeaderCharacter, fixedCharacters)
        if (cardDetails.length === preCardDetails.length) {
          return gaResult.length > 0 ? gaResult : []
        }
        preCardDetails = cardDetails
        const cards0 = sortCardsByStrength(cardDetails)
        debugLog(`DFS fallback with ${cards0.length}/${cards.length} cards`)

        const dfsState = new DFSState(Math.max(1000, timeoutMs - (Date.now() - startTime)))
        const recommend = BaseDeckRecommend.findBestCardsDFS(cards0, cards,
          deckDetail => effectiveScoreFunc(musicMeta, deckDetail), limit, liveType === LiveType.CHALLENGE, member,
          effectiveLeaderCharacter, honorBonus, eventConfig,
          skillReferenceChooseStrategy, keepAfterTrainingState, bestSkillAsLeader,
          [], dfsState, fixedCharacters, resolvedFixedCards)

        // 合并 GA 和 DFS 结果
        const merged = updateDeck(gaResult, recommend, limit)
        if (merged.length >= limit) return merged
      }
      return gaResult
    }

    // DFS 算法（原始逻辑 + 超时控制）
    let preCardDetails = [] as CardDetail[]
    while (!isTimeout()) {
      const cardDetails =
          filterCardPriority(liveType, eventType, cards, preCardDetails, member, effectiveLeaderCharacter, fixedCharacters)
      if (cardDetails.length === preCardDetails.length) {
        throw new Error(`Cannot recommend any deck in ${cards.length} cards`)
      }
      preCardDetails = cardDetails
      const cards0 = sortCardsByStrength(cardDetails)
      debugLog(`Recommend deck with ${cards0.length}/${cards.length} cards`)
      debugLog(cards0.map(it => it.cardId).toString())

      const dfsState = new DFSState(Math.max(1000, timeoutMs - (Date.now() - startTime)))
      const recommend = BaseDeckRecommend.findBestCardsDFS(cards0, cards,
        deckDetail => effectiveScoreFunc(musicMeta, deckDetail), limit, liveType === LiveType.CHALLENGE, member,
        effectiveLeaderCharacter, honorBonus, eventConfig,
        skillReferenceChooseStrategy, keepAfterTrainingState, bestSkillAsLeader,
        [], dfsState, fixedCharacters, resolvedFixedCards)
      if (recommend.length >= limit) return recommend
    }
    throw new Error(`Timeout: Cannot recommend deck in ${timeoutMs}ms`)
  }
}

/** DFS 状态管理（超时 + hash 缓存） */
class DFSState {
  public readonly deckHashCache = new Set<number>()
  public bestDecks: RecommendDeck[] = []
  private readonly startTime: number
  private readonly timeoutMs: number

  constructor (timeoutMs: number = 30000) {
    this.startTime = Date.now()
    this.timeoutMs = timeoutMs
  }

  public isTimeout (): boolean {
    return Date.now() - this.startTime > this.timeoutMs
  }
}

export type ScoreFunction = (musicMeta: MusicMeta, deckDetail: DeckDetail) => number

export interface RecommendDeck extends DeckDetail {
  score: number
}

export interface DeckRecommendConfig {
  musicMeta: MusicMeta
  limit?: number
  member?: number
  /** @deprecated 使用 fixedCharacters 代替。仍然向后兼容：内部会转换为 fixedCharacters: [leaderCharacter] */
  leaderCharacter?: number
  /** 指定一定要包含的卡牌ID列表（按位置顺序，从队长位开始） */
  fixedCards?: number[]
  /** 指定从队长位开始的卡牌所属角色ID列表（队长后的顺序无所谓） */
  fixedCharacters?: number[]
  cardConfig?: Record<string, CardConfig>
  debugLog?: (str: string) => void
  /** 推荐算法，默认 GA */
  algorithm?: RecommendAlgorithm
  /** GA 算法配置 */
  gaConfig?: GAConfig
  /** 超时时间（毫秒），默认 30 秒 */
  timeoutMs?: number
  /** 推荐优化目标，默认 Score */
  target?: RecommendTarget
  /** 吸技能选择策略，默认 Average */
  skillReferenceChooseStrategy?: SkillReferenceChooseStrategy
  /** 是否保持花前花后状态（不自动优化），默认 false */
  keepAfterTrainingState?: boolean
  /** 是否自动将技能最高的卡放到队长位，默认 true */
  bestSkillAsLeader?: boolean
}
