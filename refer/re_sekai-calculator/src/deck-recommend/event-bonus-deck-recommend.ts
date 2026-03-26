import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardConfig, type CardDetail } from '../card-information/card-calculator'
import {
  DeckCalculator,
  type DeckDetail
} from '../deck-information/deck-calculator'
import { LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { type RecommendDeck } from './base-deck-recommend'
import { AreaItemService } from '../area-item-information/area-item-service'
import { type EventConfig, EventType } from '../event-point/event-service'
import { EventService } from '../event-point/event-service'
import { safeNumber } from '../util/number-util'

// ======================== Key 编解码工具 ========================

/** 非WL: key = bonus * 100 + characterId */
function getCharaBonusKey (chara: number, bonus: number): number {
  return bonus * 100 + chara
}
function getBonusFromKey (key: number): number {
  return Math.floor(key / 100)
}
function getCharaFromKey (key: number): number {
  return key % 100
}

/** WL: key = bonus * 1000 + characterId * 10 + attr */
function getCharaAttrBonusKey (chara: number, attr: number, bonus: number): number {
  return bonus * 1000 + chara * 10 + attr
}
function getBonusFromWLKey (key: number): number {
  return Math.floor(key / 1000)
}
function getCharaFromWLKey (key: number): number {
  return Math.floor(key / 10) % 100
}
function getAttrFromWLKey (key: number): number {
  return key % 10
}

// ======================== 属性名 → 数字映射 ========================

const ATTR_MAP: Record<string, number> = {
  cool: 1,
  cute: 2,
  happy: 3,
  mysterious: 4,
  pure: 5
}
function attrToNum (attr: string): number {
  return ATTR_MAP[attr] ?? 0
}

// ======================== 分层过滤器 ========================

type BonusFilter = (key: number, getChara: (k: number) => number) => boolean

/** 按组合分层搜索：先各组合单独搜，最后全部 */
const BONUS_FILTERS: BonusFilter[] = [
  // 组合0: characterId 1-4
  (key, getChara) => { const c = getChara(key); return (Math.floor((c - 1) / 4) === 0) || c > 20 },
  // 组合1: characterId 5-8
  (key, getChara) => { const c = getChara(key); return (Math.floor((c - 1) / 4) === 1) || c > 20 },
  // 组合2: characterId 9-12
  (key, getChara) => { const c = getChara(key); return (Math.floor((c - 1) / 4) === 2) || c > 20 },
  // 组合3: characterId 13-16
  (key, getChara) => { const c = getChara(key); return (Math.floor((c - 1) / 4) === 3) || c > 20 },
  // 组合4: characterId 17-20
  (key, getChara) => { const c = getChara(key); return (Math.floor((c - 1) / 4) === 4) || c > 20 },
  // 全部
  (_key, _getChara) => true
]

function applyFilter (
  filter: BonusFilter,
  hasBonusCharaCards: Map<number, boolean>,
  getChara: (k: number) => number
): Map<number, boolean> {
  const ret = new Map<number, boolean>()
  for (const [key, hasCard] of hasBonusCharaCards) {
    if (filter(key, getChara)) {
      ret.set(key, hasCard)
    }
  }
  return ret
}

// ======================== 超时控制 ========================

class TimeoutControl {
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

// ======================== 非WL DFS ========================

/**
 * 非WL活动的加成目标DFS
 * 按 (bonus*2, characterId) 分组搜索
 */
function dfsBonusNonWL (
  member: number,
  timer: TimeoutControl,
  targets: Set<number>,
  currentBonus: number,
  current: number[],
  result: Map<number, number[][]>,
  hasBonusCharaCards: Map<number, boolean>,
  charaVis: Set<number>,
  sortedKeys: number[],
  limit: number
): boolean {
  if (current.length === member) {
    if (targets.has(currentBonus)) {
      if (!result.has(currentBonus)) result.set(currentBonus, [])
      result.get(currentBonus)!.push([...current])
      if (result.get(currentBonus)!.length >= limit) {
        targets.delete(currentBonus)
      }
    }
    return targets.size > 0
  }

  if (timer.isTimeout()) return false

  // 加成超过最大目标，剪枝
  const maxTarget = Math.max(...targets)
  if (currentBonus > maxTarget) return true

  // 获取遍历起点
  let startIdx = 0
  if (current.length > 0) {
    const lastKey = current[current.length - 1]
    startIdx = sortedKeys.indexOf(lastKey) + 1
    // 用二分查找优化
    for (let i = startIdx; i < sortedKeys.length; i++) {
      if (sortedKeys[i] > lastKey) { startIdx = i; break }
      if (i === sortedKeys.length - 1) { startIdx = sortedKeys.length; break }
    }
  }

  // 计算剩余可选的最低/最高加成用于剪枝
  const remaining = member - current.length
  let lowestBonus = 0
  let highestBonus = 0
  let countLow = 0
  let countHigh = 0

  for (let i = startIdx; i < sortedKeys.length && countLow < remaining; i++) {
    const k = sortedKeys[i]
    const chara = getCharaFromKey(k)
    if (charaVis.has(chara)) continue
    if (!hasBonusCharaCards.get(k)) continue
    lowestBonus += getBonusFromKey(k)
    countLow++
  }

  for (let i = sortedKeys.length - 1; i >= startIdx && countHigh < remaining; i--) {
    const k = sortedKeys[i]
    const chara = getCharaFromKey(k)
    if (charaVis.has(chara)) continue
    if (!hasBonusCharaCards.get(k)) continue
    highestBonus += getBonusFromKey(k)
    countHigh++
  }

  const minTarget = Math.min(...targets)
  if (currentBonus + lowestBonus > maxTarget || currentBonus + highestBonus < minTarget) {
    return true
  }

  // 搜索
  for (let i = startIdx; i < sortedKeys.length; i++) {
    const k = sortedKeys[i]
    const chara = getCharaFromKey(k)
    if (charaVis.has(chara)) continue
    if (!hasBonusCharaCards.get(k)) continue

    hasBonusCharaCards.set(k, false)
    charaVis.add(chara)
    current.push(k)

    const cont = dfsBonusNonWL(
      member, timer, targets, currentBonus + getBonusFromKey(k),
      current, result, hasBonusCharaCards, charaVis, sortedKeys, limit
    )
    if (!cont) return false

    current.pop()
    charaVis.delete(chara)
    hasBonusCharaCards.set(k, true)
  }
  return true
}

// ======================== WL DFS ========================

/**
 * WL活动的加成目标DFS
 * 按 (bonus*2, characterId, attr) 分组搜索
 */
function dfsBonusWL (
  member: number,
  timer: TimeoutControl,
  targets: Set<number>,
  currentBonus: number,
  current: number[],
  result: Map<number, number[][]>,
  hasBonusCharaCards: Map<number, boolean>,
  charaVis: Set<number>,
  attrVis: number[],
  diffAttrBonus: Map<number, number>,
  maxAttrBonus: number,
  sortedKeys: number[],
  limit: number
): boolean {
  // 计算当前异色数
  let diffAttrCount = 0
  for (let i = 0; i < attrVis.length; i++) {
    if (attrVis[i] > 0) diffAttrCount++
  }
  const currentDiffAttrBonus = diffAttrBonus.get(diffAttrCount) ?? 0

  if (current.length === member) {
    const realCurrentBonus = currentBonus + currentDiffAttrBonus
    if (targets.has(realCurrentBonus)) {
      if (!result.has(realCurrentBonus)) result.set(realCurrentBonus, [])
      result.get(realCurrentBonus)!.push([...current])
      if (result.get(realCurrentBonus)!.length >= limit) {
        targets.delete(realCurrentBonus)
      }
    }
    return targets.size > 0
  }

  if (timer.isTimeout()) return false

  const maxTarget = Math.max(...targets)
  if (currentBonus + currentDiffAttrBonus > maxTarget) return true

  // 获取遍历起点
  let startIdx = 0
  if (current.length > 0) {
    const lastKey = current[current.length - 1]
    for (let i = 0; i < sortedKeys.length; i++) {
      if (sortedKeys[i] > lastKey) { startIdx = i; break }
      if (i === sortedKeys.length - 1) { startIdx = sortedKeys.length; break }
    }
  }

  // 上下界剪枝
  const remaining = member - current.length
  let lowestBonus = 0
  let highestBonus = 0
  let countLow = 0
  let countHigh = 0

  for (let i = startIdx; i < sortedKeys.length && countLow < remaining; i++) {
    const k = sortedKeys[i]
    const chara = getCharaFromWLKey(k)
    if (charaVis.has(chara)) continue
    if (!hasBonusCharaCards.get(k)) continue
    lowestBonus += getBonusFromWLKey(k)
    countLow++
  }

  for (let i = sortedKeys.length - 1; i >= startIdx && countHigh < remaining; i--) {
    const k = sortedKeys[i]
    const chara = getCharaFromWLKey(k)
    if (charaVis.has(chara)) continue
    if (!hasBonusCharaCards.get(k)) continue
    highestBonus += getBonusFromWLKey(k)
    countHigh++
  }

  const minTarget = Math.min(...targets)
  // 最低加成用当前异色数（加入新卡异色数只会变多），最高加成用全异色上限
  if (currentBonus + currentDiffAttrBonus + lowestBonus > maxTarget ||
      currentBonus + maxAttrBonus + highestBonus < minTarget) {
    return true
  }

  // 搜索
  for (let i = startIdx; i < sortedKeys.length; i++) {
    const k = sortedKeys[i]
    const chara = getCharaFromWLKey(k)
    const attr = getAttrFromWLKey(k)
    if (charaVis.has(chara)) continue
    if (!hasBonusCharaCards.get(k)) continue

    hasBonusCharaCards.set(k, false)
    charaVis.add(chara)
    attrVis[attr]++
    current.push(k)

    const cont = dfsBonusWL(
      member, timer, targets, currentBonus + getBonusFromWLKey(k),
      current, result, hasBonusCharaCards, charaVis,
      attrVis, diffAttrBonus, maxAttrBonus, sortedKeys, limit
    )
    if (!cont) return false

    current.pop()
    attrVis[attr]--
    charaVis.delete(chara)
    hasBonusCharaCards.set(k, true)
  }
  return true
}

// ======================== 主类 ========================

/**
 * 控分组卡推荐（优化版）
 * 非WL: 按 (bonus*2, characterId) 分组 + 分层过滤 + 上下界剪枝
 * WL: 按 (bonus*2, characterId, attr) 分组 + 异色加成 + 分层过滤 + 上下界剪枝
 */
export class EventBonusDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator
  private readonly areaItemService: AreaItemService
  private readonly eventService: EventService

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
    this.areaItemService = new AreaItemService(dataProvider)
    this.eventService = new EventService(dataProvider)
  }

  /**
   * 推荐活动加成在指定范围内的卡组（控分组卡）
   */
  public async recommendEventBonusDeck (
    eventId: number, targetBonus: number,
    liveType: LiveType, config: EventBonusDeckRecommendConfig,
    specialCharacterId: number = 0,
    maxBonus?: number
  ): Promise<RecommendDeck[]> {
    const eventConfig = await this.eventService.getEventConfig(eventId, specialCharacterId)
    if (eventConfig.eventType === undefined) throw new Error(`Event type not found for ${eventId}`)
    const userCards = await this.dataProvider.getUserData<UserCard[]>('userCards')

    const {
      musicMeta,
      member = 5,
      cardConfig = {},
      specificBonuses,
      debugLog = (_: string) => { },
      timeoutMs = 30000
    } = config

    const minB = maxBonus !== undefined ? targetBonus : targetBonus
    const maxB = maxBonus !== undefined ? maxBonus : targetBonus

    const honorBonus = await this.deckCalculator.getHonorBonusPower()
    const areaItemLevels = await this.areaItemService.getAreaItemLevels()
    let cards =
      await this.cardCalculator.batchGetCardDetail(userCards, cardConfig, eventConfig, areaItemLevels)

    // 过滤箱活的卡
    const { eventUnit, worldBloomSupportUnit } = eventConfig
    let filterUnit = eventUnit
    if (worldBloomSupportUnit !== undefined) {
      filterUnit = worldBloomSupportUnit
    }
    if (filterUnit !== undefined) {
      const originCardsLength = cards.length
      cards = cards.filter(it =>
        (it.units.length === 1 && it.units[0] === 'piapro') ||
        filterUnit === undefined || it.units.includes(filterUnit))
      debugLog(`Cards filtered with unit ${filterUnit}: ${cards.length}/${originCardsLength}`)
    }

    const isWorldBloom = eventConfig.eventType === EventType.BLOOM

    // 构建目标加成列表（bonus * 2 以避免浮点数问题）
    let bonusList: number[]
    if (specificBonuses !== undefined && specificBonuses.length > 0) {
      bonusList = specificBonuses
        .filter(b => b >= minB && b <= maxB)
        .map(b => Math.round(b * 2))
      debugLog(`Searching for specific bonuses: ${specificBonuses.join(', ')} in [${minB}, ${maxB}]`)
    } else {
      // 生成范围内所有可能的 bonus*2 整数值
      bonusList = []
      for (let b2 = Math.ceil(minB * 2); b2 <= Math.floor(maxB * 2); b2++) {
        bonusList.push(b2)
      }
      debugLog(`Searching for bonus in [${minB}, ${maxB}] (${bonusList.length} targets) in ${cards.length} cards`)
    }

    if (bonusList.length === 0) {
      debugLog('No target bonuses to search')
      return []
    }

    bonusList.sort((a, b) => a - b)

    const timer = new TimeoutControl(timeoutMs)
    let results: RecommendDeck[]

    if (isWorldBloom) {
      results = this.findBonusDeckWL(
        cards, bonusList, honorBonus, member, eventConfig, timer, debugLog
      )
    } else {
      results = this.findBonusDeckNonWL(
        cards, bonusList, honorBonus, member, eventConfig, timer, debugLog
      )
    }

    // 按加成从低到高排序
    results.sort((a, b) => a.score - b.score)
    debugLog(`Found ${results.length} deck(s)`)
    return results
  }

  // ======================== 非WL搜索 ========================

  private findBonusDeckNonWL (
    cards: CardDetail[], bonusList: number[], honorBonus: number,
    member: number, eventConfig: EventConfig,
    timer: TimeoutControl, debugLog: (str: string) => void
  ): RecommendDeck[] {
    const allCards = cards

    // 按 (bonus*2, characterId) 归类
    const bonusCharaCards = new Map<number, CardDetail[]>()
    const hasBonusCharaCards = new Map<number, boolean>()

    for (const card of cards) {
      if (card.eventBonus === undefined) continue
      const maxBonus = card.eventBonus.getMaxBonus(true)
      if (maxBonus <= 0) continue
      const bonus2 = Math.round(maxBonus * 2)
      // 跳过非整数加成（精度问题）
      if (Math.abs(bonus2 - maxBonus * 2) > 1e-6) continue

      const key = getCharaBonusKey(card.characterId, bonus2)
      if (!bonusCharaCards.has(key)) bonusCharaCards.set(key, [])
      bonusCharaCards.get(key)!.push(card)
      hasBonusCharaCards.set(key, true)
    }

    const targets = new Set(bonusList)
    const results: RecommendDeck[] = []

    // 分层过滤搜索
    for (const filter of BONUS_FILTERS) {
      if (targets.size === 0) break
      if (timer.isTimeout()) break

      const filtered = applyFilter(filter, hasBonusCharaCards, getCharaFromKey)
      const sortedKeys = Array.from(filtered.keys()).sort((a, b) => a - b)

      const current: number[] = []
      const dfsResult = new Map<number, number[][]>()
      const charaVis = new Set<number>()

      dfsBonusNonWL(
        member, timer, targets, 0,
        current, dfsResult, filtered, charaVis, sortedKeys, 1
      )

      // 从搜索结果中取卡并计算卡组详情
      for (const [bonus2, bonusResults] of dfsResult) {
        for (const resultKeys of bonusResults) {
          const deckCards: CardDetail[] = []
          for (const key of resultKeys) {
            const cardList = bonusCharaCards.get(key)
            if (cardList !== undefined && cardList.length > 0) {
              deckCards.push(cardList[0])
            }
          }
          if (deckCards.length !== member) continue

          const deckDetail = DeckCalculator.getDeckDetailByCards(
            deckCards, allCards, honorBonus, eventConfig.cardBonusCountLimit,
            eventConfig.worldBloomDifferentAttributeBonuses
          )
          const actualBonus = safeNumber(deckDetail.eventBonus) + safeNumber(deckDetail.supportDeckBonus)
          // 验证加成正确
          if (Math.abs(actualBonus * 2 - bonus2) < 1e-3) {
            const ret = deckDetail as RecommendDeck
            ret.score = actualBonus
            results.push(ret)
          } else {
            debugLog(`Warning: bonus mismatch, expected ${bonus2 / 2}, got ${actualBonus}`)
          }
        }
      }
    }

    return results
  }

  // ======================== WL搜索 ========================

  private findBonusDeckWL (
    cards: CardDetail[], bonusList: number[], honorBonus: number,
    member: number, eventConfig: EventConfig,
    timer: TimeoutControl, debugLog: (str: string) => void
  ): RecommendDeck[] {
    const allCards = cards

    // 按 (bonus*2, characterId, attr) 归类
    const bonusCharaCards = new Map<number, CardDetail[]>()
    const hasBonusCharaCards = new Map<number, boolean>()

    for (const card of cards) {
      if (card.eventBonus === undefined) continue
      const maxBonus = card.eventBonus.getMaxBonus(true)
      if (maxBonus <= 0) continue
      const bonus2 = Math.round(maxBonus * 2)
      if (Math.abs(bonus2 - maxBonus * 2) > 1e-6) continue

      const attrNum = attrToNum(card.attr)
      const key = getCharaAttrBonusKey(card.characterId, attrNum, bonus2)
      if (!bonusCharaCards.has(key)) bonusCharaCards.set(key, [])
      bonusCharaCards.get(key)!.push(card)
      hasBonusCharaCards.set(key, true)
    }

    // WL异色加成
    const diffAttrBonus = new Map<number, number>()
    let maxAttrBonus = 0
    if (eventConfig.worldBloomDifferentAttributeBonuses !== undefined) {
      for (const bonus of eventConfig.worldBloomDifferentAttributeBonuses) {
        const val = Math.round(bonus.bonusRate * 2)
        diffAttrBonus.set(bonus.attributeCount, val)
        maxAttrBonus = Math.max(maxAttrBonus, val)
      }
    }
    // 确保所有 0-5 都有值
    for (let i = 0; i <= 5; i++) {
      if (!diffAttrBonus.has(i)) diffAttrBonus.set(i, 0)
    }

    const targets = new Set(bonusList)
    const results: RecommendDeck[] = []

    // 分层过滤搜索
    for (const filter of BONUS_FILTERS) {
      if (targets.size === 0) break
      if (timer.isTimeout()) break

      const filtered = applyFilter(filter, hasBonusCharaCards, getCharaFromWLKey)
      const sortedKeys = Array.from(filtered.keys()).sort((a, b) => a - b)

      const current: number[] = []
      const dfsResult = new Map<number, number[][]>()
      const charaVis = new Set<number>()
      const attrVis = new Array(10).fill(0)

      dfsBonusWL(
        member, timer, targets, 0,
        current, dfsResult, filtered, charaVis,
        attrVis, diffAttrBonus, maxAttrBonus, sortedKeys, 1
      )

      // 从搜索结果中取卡并计算卡组详情
      for (const [bonus2, bonusResults] of dfsResult) {
        for (const resultKeys of bonusResults) {
          const deckCards: CardDetail[] = []
          for (const key of resultKeys) {
            const cardList = bonusCharaCards.get(key)
            if (cardList !== undefined && cardList.length > 0) {
              deckCards.push(cardList[0])
            }
          }
          if (deckCards.length !== member) continue

          const deckDetail = DeckCalculator.getDeckDetailByCards(
            deckCards, allCards, honorBonus, eventConfig.cardBonusCountLimit,
            eventConfig.worldBloomDifferentAttributeBonuses
          )
          const actualBonus = safeNumber(deckDetail.eventBonus) + safeNumber(deckDetail.supportDeckBonus)
          if (Math.abs(actualBonus * 2 - bonus2) < 1e-3) {
            const ret = deckDetail as RecommendDeck
            ret.score = actualBonus
            results.push(ret)
          } else {
            debugLog(`Warning: WL bonus mismatch, expected ${bonus2 / 2}, got ${actualBonus}`)
          }
        }
      }
    }

    return results
  }
}

/**
 * 控分组卡推荐设置
 */
export interface EventBonusDeckRecommendConfig {
  musicMeta: MusicMeta
  member?: number
  cardConfig?: Record<string, CardConfig>
  specificBonuses?: number[]
  debugLog?: (str: string) => void
  /** 超时时间（毫秒），默认30秒 */
  timeoutMs?: number
}
