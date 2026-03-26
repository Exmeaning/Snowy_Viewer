import { type CardDetail } from '../card-information/card-calculator'
import { DeckCalculator, SkillReferenceChooseStrategy, type DeckDetail } from '../deck-information/deck-calculator'
import { type RecommendDeck, type ScoreFunction } from './base-deck-recommend'
import { type EventConfig } from '../event-point/event-service'
import { type MusicMeta } from '../common/music-meta'
import { swap } from '../util/collection-util'

// ======================== 配置 ========================

export interface GAConfig {
  /** 随机数种子，-1 使用当前时间 */
  seed?: number
  /** 最大迭代次数 */
  maxIter?: number
  /** 最大无改进迭代次数 */
  maxIterNoImprove?: number
  /** 种群大小 */
  popSize?: number
  /** 父代数量 */
  parentSize?: number
  /** 精英数量 */
  eliteSize?: number
  /** 交叉率 */
  crossoverRate?: number
  /** 基础变异率 */
  baseMutationRate?: number
  /** 无改进迭代次数转换为变异率的比例 */
  noImproveIterToMutationRate?: number
  /** 超时时间（毫秒） */
  timeoutMs?: number
  /** 推荐优化目标（用于加权随机选择）：'skill' 时按技能权重，其他按综合力权重 */
  target?: string
}

const DEFAULT_GA_CONFIG: Required<GAConfig> = {
  seed: -1,
  maxIter: 1000,
  maxIterNoImprove: 10,
  popSize: 8000,
  parentSize: 800,
  eliteSize: 10,
  crossoverRate: 1.0,
  baseMutationRate: 0.1,
  noImproveIterToMutationRate: 0.02,
  timeoutMs: 15000,
  target: 'score'
}

// ======================== 简易伪随机数生成器 ========================

class SimpleRng {
  private state: number

  constructor (seed: number) {
    this.state = seed & 0x7fffffff
    if (this.state === 0) this.state = 1
  }

  /** 返回 [0, 1) 的浮点数 */
  next (): number {
    // xorshift32
    this.state ^= this.state << 13
    this.state ^= this.state >>> 17
    this.state ^= this.state << 5
    return (this.state >>> 0) / 4294967296
  }

  /** 返回 [0, max) 的整数 */
  nextInt (max: number): number {
    return Math.floor(this.next() * max)
  }
}

// ======================== 个体 ========================

interface Individual {
  deck: CardDetail[]
  deckHash: number
  fitness: number
}

// ======================== 工具函数 ========================

/** 计算卡组哈希（第一位 + 后几位排序后） */
function calcDeckHash (deck: CardDetail[]): number {
  if (deck.length === 0) return 0
  const ids = deck.map(c => c.cardId)
  // 后面的排序
  const sorted = ids.slice(1).sort((a, b) => a - b)
  const BASE = 10007
  let hash = ids[0]
  for (const id of sorted) {
    hash = ((hash * BASE) + id) | 0
  }
  return hash >>> 0
}

/**
 * 计算加权随机选择的前缀和数组（参考 C++ 库 calcRandomSelectWeights）
 * 综合力/技能越高的卡牌被选中概率越大（权重为值的平方）
 * @param cards 卡牌列表
 * @param target 优化目标
 * @param excludedCardIds 需要排除的卡牌ID集合
 * @returns 归一化后的前缀和数组
 */
function calcWeightedPrefixSum (
  cards: CardDetail[], target: string, excludedCardIds: Set<number>
): number[] {
  const weights: number[] = new Array(cards.length)
  let sum = 0
  for (let i = 0; i < cards.length; i++) {
    if (excludedCardIds.has(cards[i].cardId)) {
      weights[i] = 0
      continue
    }
    let val: number
    if (target === 'skill') {
      val = cards[i].skill.getMax()
    } else {
      val = cards[i].power.getMax()
    }
    // 以平方为权重以扩大差距（参考 C++ 库）
    weights[i] = val * val
    sum += weights[i]
  }
  // 归一化并计算前缀和
  if (sum > 0) {
    weights[0] /= sum
    for (let i = 1; i < weights.length; i++) {
      weights[i] = weights[i] / sum + weights[i - 1]
    }
  }
  return weights
}

/**
 * 根据前缀和权重数组随机选择一个索引
 */
function weightedRandomSelect (rng: SimpleRng, prefixSum: number[]): number {
  if (prefixSum.length === 0) return 0
  const r = rng.next()
  // 二分查找
  let lo = 0; let hi = prefixSum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (prefixSum[mid] < r) lo = mid + 1
    else hi = mid
  }
  return lo
}


// ======================== GA 主函数 ========================

/**
 * 使用遗传算法寻找最佳卡组
 * 参考 C++ 库 (NeuraXmy/sekai-deck-recommend-cpp) 的 fixedCards/fixedCharacters 处理策略
 * @param cardDetails 参与计算的卡牌
 * @param allCards 全部卡牌（用于支援卡组计算）
 * @param scoreFunc 分数计算函数
 * @param musicMeta 歌曲信息
 * @param limit 需要推荐的卡组数量
 * @param isChallengeLive 是否挑战Live
 * @param member 人数限制
 * @param honorBonus 称号加成
 * @param eventConfig 活动配置
 * @param gaConfig GA配置
 * @param fixedCharacters 固定角色ID列表（按位置顺序）
 * @param fixedCards 固定卡牌CardDetail列表
 */
export function findBestCardsGA (
  cardDetails: CardDetail[],
  allCards: CardDetail[],
  scoreFunc: ScoreFunction,
  musicMeta: MusicMeta,
  limit: number = 1,
  isChallengeLive: boolean = false,
  member: number = 5,
  honorBonus: number = 0,
  eventConfig: EventConfig = {},
  gaConfig: GAConfig = {},
  skillReferenceChooseStrategy: SkillReferenceChooseStrategy = SkillReferenceChooseStrategy.Average,
  keepAfterTrainingState: boolean = false,
  bestSkillAsLeader: boolean = true,
  leaderCharacter: number = 0,
  fixedCharacters: number[] = [],
  fixedCards: CardDetail[] = []
): RecommendDeck[] {
  const cfg = { ...DEFAULT_GA_CONFIG, ...gaConfig }
  const fixedSize = fixedCards.length

  if (isChallengeLive) {
    member = Math.min(member, cardDetails.length)
  }

  if (cardDetails.length < member) {
    return []
  }

  // 存在固定角色/卡牌则不允许把技能最强的换到队长
  const effectiveBestSkillAsLeader = (fixedCharacters.length > 0 || fixedSize > 0) ? false : bestSkillAsLeader

  const seed = cfg.seed === -1 ? Date.now() : cfg.seed
  const rng = new SimpleRng(seed)
  const startTime = Date.now()

  const isTimeout = (): boolean => Date.now() - startTime > cfg.timeoutMs

  // 按角色分组
  const MAX_CID = 27
  const charaCards: CardDetail[][] = Array.from({ length: MAX_CID }, () => [])
  for (const card of cardDetails) {
    charaCards[card.characterId].push(card)
  }

  // 构建固定卡牌的 cardId 集合和角色集合
  const fixedCardIds = new Set(fixedCards.map(c => c.cardId))
  const fixedCardCharacterIds = new Set(fixedCards.map(c => c.characterId))
  const fixedCharacterSet = new Set(fixedCharacters)

  // 计算加权随机选择的前缀和（参考 C++ 库 calcRandomSelectWeights）
  const target = cfg.target
  const allCardWeights = calcWeightedPrefixSum(cardDetails, target, fixedCardIds)
  const charaCardWeights: number[][] = Array.from({ length: MAX_CID }, () => [])
  for (let i = 0; i < MAX_CID; i++) {
    if (charaCards[i].length > 0) {
      charaCardWeights[i] = calcWeightedPrefixSum(charaCards[i], target, fixedCardIds)
    }
  }

  // deck hash 缓存
  const deckScoreCache = new Map<number, number>()

  // 结果管理
  let bestDecks: RecommendDeck[] = []

  const updateResult = (deck: RecommendDeck): void => {
    // 防御性检查：卡组内部不应有重复卡片
    const deckCardIds = new Set(deck.cards.map(c => c.cardId))
    if (deckCardIds.size !== deck.cards.length) return

    // 使用完整卡组 cardId 集合比较去重
    const exists = bestDecks.some(d => {
      if (d.cards.length !== deck.cards.length) return false
      return d.cards.every(c => deckCardIds.has(c.cardId))
    })
    if (exists) return

    bestDecks.push(deck)
    bestDecks.sort((a, b) => b.score - a.score)
    if (bestDecks.length > limit) {
      bestDecks = bestDecks.slice(0, limit)
    }
  }

  // 评估个体
  const evaluateIndividual = (individual: Individual): void => {
    const hash = calcDeckHash(individual.deck)
    individual.deckHash = hash

    if (deckScoreCache.has(hash)) {
      individual.fitness = deckScoreCache.get(hash)!
      return
    }

    try {
      if (fixedCharacters.length > 0 || fixedSize > 0) {
        // 有固定角色/卡牌时不调整C位，直接评估
        const deckDetail = DeckCalculator.getDeckDetailByCards(
          individual.deck, allCards, honorBonus,
          eventConfig.cardBonusCountLimit,
          eventConfig.worldBloomDifferentAttributeBonuses,
          skillReferenceChooseStrategy, keepAfterTrainingState, false
        )
        const score = scoreFunc(musicMeta, deckDetail)
        individual.fitness = score
        deckScoreCache.set(hash, score)
        const recDeck = deckDetail as RecommendDeck
        recDeck.score = score
        updateResult(recDeck)
      } else {
        // 策略A：按技能选C位（原始逻辑）
        const dd1 = DeckCalculator.getDeckDetailByCards(
          individual.deck, allCards, honorBonus,
          eventConfig.cardBonusCountLimit,
          eventConfig.worldBloomDifferentAttributeBonuses,
          skillReferenceChooseStrategy, keepAfterTrainingState, true
        )
        const s1 = scoreFunc(musicMeta, dd1)

        // 策略B：按 leaderBonus 最高的卡作为C位
        let bestLeaderIdx = 0
        let bestLeaderBonus = -1
        for (let i = 0; i < individual.deck.length; i++) {
          const card = individual.deck[i]
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
          swap(individual.deck, 0, bestLeaderIdx)
          dd2 = DeckCalculator.getDeckDetailByCards(
            individual.deck, allCards, honorBonus,
            eventConfig.cardBonusCountLimit,
            eventConfig.worldBloomDifferentAttributeBonuses,
            skillReferenceChooseStrategy, keepAfterTrainingState, false
          )
          s2 = scoreFunc(musicMeta, dd2)
          swap(individual.deck, 0, bestLeaderIdx) // 恢复
        }

        // 取更高分的策略
        const bestScore = s2 > s1 ? s2 : s1
        const bestDetail = (s2 > s1 && dd2 !== null) ? dd2 : dd1

        individual.fitness = bestScore
        deckScoreCache.set(hash, bestScore)
        const recDeck = bestDetail as RecommendDeck
        recDeck.score = bestScore
        updateResult(recDeck)
      }
    } catch {
      individual.fitness = -1
      deckScoreCache.set(hash, -1)
    }
  }

  // 按组合和属性分组角色（用于种群初始化的同色/同组偏向）
  const unitCharaMap = new Map<string, number[]>() // unit → characterId[]
  const attrCharaMap = new Map<string, number[]>() // attr → characterId[]
  for (let j = 0; j < MAX_CID; j++) {
    if (charaCards[j].length === 0) continue
    if (fixedCardCharacterIds.has(j) || fixedCharacterSet.has(j)) continue
    // 收集该角色所有可能的 unit 和 attr
    const unitSet = new Set<string>()
    const attrSet = new Set<string>()
    for (const card of charaCards[j]) {
      card.units.forEach(u => unitSet.add(u))
      attrSet.add(card.attr)
    }
    for (const u of unitSet) {
      if (!unitCharaMap.has(u)) unitCharaMap.set(u, [])
      unitCharaMap.get(u)!.push(j)
    }
    for (const a of attrSet) {
      if (!attrCharaMap.has(a)) attrCharaMap.set(a, [])
      attrCharaMap.get(a)!.push(j)
    }
  }
  // 收集能组出 >= member 个角色的组合/属性（用于偏向选择）
  const viableUnitGroups = [...unitCharaMap.entries()].filter(([, v]) => v.length >= member - fixedSize - fixedCharacters.length)
  const viableAttrGroups = [...attrCharaMap.entries()].filter(([, v]) => v.length >= member - fixedSize - fixedCharacters.length)
  const hasViableGroups = viableUnitGroups.length > 0 || viableAttrGroups.length > 0

  // 生成随机个体（参考 C++ 库的种群生成逻辑）
  const generateRandomIndividual = (biased: boolean): Individual | null => {
    const deck: CardDetail[] = []
    const usedCharas = new Set<number>()
    const usedCardIds = new Set<number>()

    if (!isChallengeLive) {
      // 收集可用角色（排除固定卡牌的角色和固定角色）
      const validCharas: number[] = []
      for (let j = 0; j < MAX_CID; j++) {
        if (charaCards[j].length === 0) continue
        if (fixedCardCharacterIds.has(j)) continue
        if (fixedCharacterSet.has(j)) continue
        validCharas.push(j)
      }

      const freeSlots = member - fixedSize - fixedCharacters.length
      if (validCharas.length < freeSlots) return null

      // 先添加固定角色的卡（加权随机选一张该角色的卡）
      for (const chara of fixedCharacters) {
        const cards = charaCards[chara]
        if (cards.length === 0) return null
        const idx = weightedRandomSelect(rng, charaCardWeights[chara])
        const card = cards[idx]
        deck.push(card)
        usedCharas.add(chara)
        usedCardIds.add(card.cardId)
      }

      let selectedCharas: number[]

      // 偏向模式：从同组或同属性的角色中选择
      if (biased && hasViableGroups) {
        const allGroups = [...viableUnitGroups, ...viableAttrGroups]
        const group = allGroups[rng.nextInt(allGroups.length)][1]
        // 从该组中随机选 freeSlots 个不重复的角色
        const shuffled = [...group]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = rng.nextInt(i + 1)
          const tmp = shuffled[i]
          shuffled[i] = shuffled[j]
          shuffled[j] = tmp
        }
        selectedCharas = shuffled.slice(0, freeSlots)
      } else {
        // 完全随机模式
        for (let i = validCharas.length - 1; i > 0; i--) {
          const j = rng.nextInt(i + 1)
          const tmp = validCharas[i]
          validCharas[i] = validCharas[j]
          validCharas[j] = tmp
        }
        selectedCharas = validCharas.slice(0, freeSlots)
      }

      for (const chara of selectedCharas) {
        const cards = charaCards[chara]
        const idx = weightedRandomSelect(rng, charaCardWeights[chara])
        deck.push(cards[idx])
        usedCharas.add(chara)
        usedCardIds.add(cards[idx].cardId)
      }
    } else {
      // 挑战Live：加权随机选 member-fixedSize 张不重复的卡
      const indices: number[] = []
      let attempts = 0
      while (indices.length < member - fixedSize && attempts < 100) {
        const idx = weightedRandomSelect(rng, allCardWeights)
        const card = cardDetails[idx]
        if (!usedCardIds.has(card.cardId) && !fixedCardIds.has(card.cardId)) {
          usedCardIds.add(card.cardId)
          indices.push(idx)
        }
        attempts++
      }
      if (indices.length < member - fixedSize) return null
      for (const idx of indices) {
        deck.push(cardDetails[idx])
      }
    }

    // 添加固定卡牌（整个流程固定在最后，参考 C++ 库）
    for (const card of fixedCards) {
      deck.push(card)
    }

    return { deck, deckHash: 0, fitness: 0 }
  }

  // 交叉（参考 C++ 库的交叉逻辑：保护固定角色位和固定卡牌位）
  const crossover = (a: Individual, b: Individual): Individual | null => {
    if (rng.next() > cfg.crossoverRate) {
      return a.fitness >= b.fitness ? { ...a, deck: [...a.deck] } : { ...b, deck: [...b.deck] }
    }

    const deck: CardDetail[] = []
    const usedCharas = new Set<number>()
    const usedCardIds = new Set<number>()

    // 非固定部分的长度
    const nonFixedLen = a.deck.length - fixedSize

    // 随机选择要保留的 a 位置（不包括固定卡牌位）
    const keepFromA: number[] = []
    for (let i = 0; i < nonFixedLen; i++) {
      const card = a.deck[i]
      // 如果是固定角色则一定保留（参考 C++ 逻辑）
      if (fixedCharacterSet.has(card.characterId)) {
        keepFromA.push(i)
        continue
      }
      if (rng.next() < 0.5) {
        keepFromA.push(i)
      }
    }

    // 添加 a 中保留的卡
    for (const idx of keepFromA) {
      const card = a.deck[idx]
      deck.push(card)
      usedCharas.add(card.characterId)
      usedCardIds.add(card.cardId)
    }

    // 从 b 中补充不冲突的卡（不包括固定卡牌位）
    const bCandidates: number[] = []
    for (let i = 0; i < nonFixedLen; i++) {
      const card = b.deck[i]
      if (usedCardIds.has(card.cardId)) continue
      if (!isChallengeLive && usedCharas.has(card.characterId)) continue
      bCandidates.push(i)
    }

    // 随机打乱 b 候选
    for (let i = bCandidates.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1)
      const tmp = bCandidates[i]
      bCandidates[i] = bCandidates[j]
      bCandidates[j] = tmp
    }

    const needed = nonFixedLen - deck.length
    for (let i = 0; i < Math.min(needed, bCandidates.length); i++) {
      const card = b.deck[bCandidates[i]]
      deck.push(card)
      usedCharas.add(card.characterId)
      usedCardIds.add(card.cardId)
    }

    if (deck.length < nonFixedLen) return null

    // 添加固定卡牌
    for (const card of fixedCards) {
      deck.push(card)
    }

    if (deck.length !== member) return null

    return { deck, deckHash: 0, fitness: 0 }
  }

  // 变异（参考 C++ 库：固定角色位只能在同角色内换卡，固定卡牌位不参与变异，使用加权随机）
  const mutate = (individual: Individual, mutationRate: number): void => {
    const nonFixedLen = individual.deck.length - fixedSize
    for (let pos = 0; pos < nonFixedLen; pos++) {
      if (rng.next() > mutationRate) continue

      const isFixedChara = fixedCharacterSet.has(individual.deck[pos].characterId)

      // 尝试替换
      for (let attempt = 0; attempt < 10; attempt++) {
        let newCard: CardDetail
        if (isFixedChara) {
          // 固定角色位只能在同角色内换卡（加权随机）
          const chara = individual.deck[pos].characterId
          const cards = charaCards[chara]
          if (cards.length <= 1) break
          const idx = weightedRandomSelect(rng, charaCardWeights[chara])
          newCard = cards[idx]
        } else {
          // 非固定角色位：从全部卡牌中加权随机选择（参考 C++ 库）
          const idx = weightedRandomSelect(rng, allCardWeights)
          newCard = cardDetails[idx]
        }

        // 检查冲突
        let ok = true
        for (let i = 0; i < individual.deck.length; i++) {
          if (i === pos) continue
          if (individual.deck[i].cardId === newCard.cardId) { ok = false; break }
          if (!isChallengeLive && individual.deck[i].characterId === newCard.characterId) { ok = false; break }
        }
        if (ok) {
          individual.deck[pos] = newCard
          break
        }
      }
    }
  }

  // ======================== 主循环 ========================

  // 如果全部固定，直接评估一次
  if (member === fixedSize + fixedCharacters.length) {
    const ind = generateRandomIndividual(false)
    if (ind !== null) {
      evaluateIndividual(ind)
    }
    return bestDecks
  }

  // 生成初始种群（前 50% 使用同组/同属性偏向，后 50% 完全随机）
  let population: Individual[] = []
  for (let i = 0; i < cfg.popSize; i++) {
    if (isTimeout()) break
    const useBias = hasViableGroups && i < cfg.popSize * 0.5
    const ind = generateRandomIndividual(useBias)
    if (ind === null) continue
    evaluateIndividual(ind)
    if (ind.fitness >= 0) {
      population.push(ind)
    }
  }

  if (population.length === 0) {
    return bestDecks
  }

  // 用初始种群的最高 fitness 初始化，避免第一代就误判为无改进
  let curMaxFitness = population.reduce((max, ind) => Math.max(max, ind.fitness), 0)
  let lastMaxFitness = 0
  let noImproveIter = 0

  // 迭代进化
  for (let iter = 0; iter < cfg.maxIter; iter++) {
    if (isTimeout()) break

    // 排序
    population.sort((a, b) => b.fitness - a.fitness)
    lastMaxFitness = curMaxFitness
    const curMutationRate = cfg.baseMutationRate + cfg.noImproveIterToMutationRate * noImproveIter

    const newPopulation: Individual[] = []

    // 保留精英
    const eliteSize = Math.min(cfg.eliteSize, population.length)
    for (let i = 0; i < eliteSize; i++) {
      newPopulation.push(population[i])
    }

    // 繁殖
    const parentSize = Math.min(cfg.parentSize, population.length)
    while (newPopulation.length < cfg.popSize) {
      if (isTimeout()) break

      const idx1 = rng.nextInt(parentSize)
      const idx2 = rng.nextInt(parentSize)
      const child = crossover(population[idx1], population[idx2])
      if (child === null) continue

      mutate(child, curMutationRate)
      evaluateIndividual(child)
      newPopulation.push(child)
      curMaxFitness = Math.max(curMaxFitness, child.fitness)
    }

    // 去重
    const seen = new Set<number>()
    population = []
    for (const ind of newPopulation) {
      if (!seen.has(ind.deckHash)) {
        population.push(ind)
        seen.add(ind.deckHash)
      }
    }

    // 检查收敛
    if (curMaxFitness <= lastMaxFitness) {
      noImproveIter++
      if (noImproveIter > cfg.maxIterNoImprove) break
    } else {
      noImproveIter = 0
    }
  }

  return bestDecks
}
