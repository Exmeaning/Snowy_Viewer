import { type CardDetail } from '../card-information/card-calculator'
import { computeWithDefault, mapToString } from '../util/collection-util'
import { LiveType } from '../live-score/live-calculator'
import { EventType } from '../event-point/event-service'
import { challengeLiveCardPriorities } from './challenge-live-card-priority'
import { bloomCardPriorities } from './bloom-event-card-priority'
import { marathonCheerfulCardPriorities } from './marathon-cheerful-event-card-priority'

/**
 * 使用DFS搜索增广路
 * @param attrMap 属性->角色 多重映射
 * @param attrs 属性->角色 唯一映射
 * @param chars 角色->属性 唯一映射
 * @param visit 属性->轮次 唯一映射
 * @param round 当前轮次
 * @param attr 属性
 */
function checkAttrForBloomDfs (
  attrMap: Map<string, Set<number>>, attrs: Map<string, number>, chars: Map<number, string>,
  visit: Map<string, number>, round: number, attr: string
): boolean {
  visit.set(attr, round)
  const charForAttr = attrMap.get(attr)
  if (charForAttr === undefined) throw new Error(`${attr} not found in map ${mapToString(attrMap)}`)
  // 如果还有角色未选择属性，直接选择
  for (const char of charForAttr) {
    if (!chars.has(char)) {
      chars.set(char, attr)
      attrs.set(attr, char)
      return true
    }
  }
  // 不然就要判断有没有角色的属性可以变更
  for (const char of charForAttr) {
    const attrForChar = chars.get(char)
    if (attrForChar === undefined) throw new Error(`${char} not found in map ${mapToString(chars)}`)
    const attrForCharRound = visit.get(attrForChar)
    if (attrForCharRound === undefined) throw new Error(`${attrForChar} not found in map ${mapToString(visit)}`)
    if (attrForCharRound !== round && checkAttrForBloomDfs(attrMap, attrs, chars, visit, round, attrForChar)) {
      chars.set(char, attr)
      attrs.set(attr, char)
      return true
    }
  }
  return false
}

/**
 * 为世界开花活动检查是否可以组出5种属性的队伍
 * @param attrMap key为属性，value为角色
 */
function checkAttrForBloom (attrMap: Map<string, Set<number>>): boolean {
  // 满足不了5色的肯定不行
  if (attrMap.size < 5) return false
  let min = 114514
  for (const v of attrMap.values()) {
    min = Math.min(min, v.size)
  }
  // 如果所有属性的可选角色都大于等于5个，那肯定能满足5色队，不然就要进一步判断
  if (min >= 5) return true

  // 使用二分图最大匹配算法，左半边为5种属性、右半边为26位角色
  // 复杂度O(nm)约等于130
  // 可参考：https://oi-wiki.org/graph/graph-matching/bigraph-match/
  const attrs = new Map<string, number>()
  const chars = new Map<number, string>()
  const visit = new Map<string, number>()
  let ans = 0
  let round = 0
  while (true) {
    round++
    let count = 0
    for (const attr of attrMap.keys()) {
      if (!visit.has(attr) && checkAttrForBloomDfs(attrMap, attrs, chars, visit, round, attr)) {
        count++
      }
    }
    if (count === 0) break
    ans += count
  }

  return ans === 5
}

/**
 * 判断某属性或者组合角色数量至少5个
 * @param liveType Live类型
 * @param eventType 活动类型
 * @param cardDetails 卡牌
 * @param member 卡组成员限制
 */
function canMakeDeck (liveType: LiveType, eventType: EventType, cardDetails: CardDetail[], member: number = 5): boolean {
  // 统计组合或者属性的不同角色出现次数
  const attrMap = new Map<string, Set<number>>()
  const unitMap = new Map<string, Set<number>>()
  for (const cardDetail of cardDetails) {
    // 因为挑战Live的卡牌可以重复，所以属性要按卡的数量算
    computeWithDefault(attrMap, cardDetail.attr, new Set(),
      it => it.add(liveType === LiveType.CHALLENGE ? cardDetail.cardId : cardDetail.characterId))
    for (const unit of cardDetail.units) {
      computeWithDefault(unitMap, unit, new Set(), it => it.add(cardDetail.characterId))
    }
  }

  if (liveType === LiveType.CHALLENGE) {
    // 对于挑战Live来说，如果卡组数量小于5（无双倍属性加成）只要有卡够就可以组队了
    if (member < 5) {
      return cardDetails.length >= member
    }
    // 不然就要判断能否组出所有属性的同色队伍（双倍属性加成可能会抵消一些低稀有度损失）
    for (const v of attrMap.values()) {
      if (v.size < 5) return false
    }
    return true
  }

  switch (eventType) {
    case EventType.MARATHON:
    case EventType.CHEERFUL:
      // 对于马拉松、欢乐嘉年华活动来说，如果有任何一个大于等于5（能组出同色或同队），就没问题
      for (const v of attrMap.values()) {
        if (v.size >= 5) return true
      }
      for (const v of unitMap.values()) {
        if (v.size >= 5) return true
      }
      return false
    case EventType.BLOOM:
      // 对于世界开花活动，必须要满足能组出一个团队，且能组出5种属性的队伍
      for (const v of unitMap.values()) {
        if (v.size >= 5) return true
      }
      return checkAttrForBloom(attrMap)
    default:
      // 未知活动类型，只能先认为无论如何都组不出合理队伍，要求全卡计算
      return false
  }
}

/**
 * 根据给定优先级过滤卡牌
 * @param liveType Live类型
 * @param eventType 活动类型
 * @param cardDetails 卡牌
 * @param preCardDetails 上一次的卡牌，保证返回卡牌数量大于等于它，且能组成队伍
 * @param member 卡组成员限制
 * @param leader 固定的队长角色（用于判断leader加成，向后兼容）
 * @param fixedCharacters 固定角色ID列表（扩展支持多个固定角色）
 */
export function filterCardPriority (
  liveType: LiveType, eventType: EventType, cardDetails: CardDetail[], preCardDetails: CardDetail[], member: number = 5, leader: number = 0, fixedCharacters: number[] = []
): CardDetail[] {
  // 构建固定角色集合（合并 leader 和 fixedCharacters）
  const fixedCharacterSet = new Set(fixedCharacters)
  if (leader > 0) fixedCharacterSet.add(leader)

  const cardPriorities = getCardPriorities(liveType, eventType)
  let cards: CardDetail[] = []
  let latestPriority = Number.MIN_SAFE_INTEGER
  const cardIds = new Set<number>()
  for (const cardPriority of cardPriorities) {
    // 检查是否已经是符合优先级条件的完整卡组
    // 因为同一个优先级可能有不止一个情况，所以要等遍历到下个优先级后才能决定是否返回
    if (cardPriority.priority > latestPriority && cards.length > preCardDetails.length && canMakeDeck(liveType, eventType, cards, member)) {
      return cards
    }
    latestPriority = cardPriority.priority
    // 追加符合优先级限制的卡牌
    // 要保证不添加额外的重复卡牌
    // 固定角色的卡牌使用 getMaxBonus(true) 计算（包含队长加成），其他卡牌使用 getMaxBonus(false)
    const filtered = cardDetails
      .filter(it => !cardIds.has(it.cardId) &&
        it.cardRarityType === cardPriority.cardRarityType &&
        it.masterRank >= cardPriority.masterRank &&
        (it.eventBonus === undefined ||
            it.eventBonus.getMaxBonus(fixedCharacterSet.size === 0 || fixedCharacterSet.has(it.characterId)) >= cardPriority.eventBonus))
    filtered.forEach(it => cardIds.add(it.cardId))
    cards = [...cards, ...filtered]
  }
  // 所有优先级已经结束，直接返回全部卡牌
  return cardDetails
}

/**
 * 卡牌优先级
 * 获取到的卡牌优先级需要根据priority从小到大排列
 * @param liveType Live类型
 * @param eventType 活动类型
 */
function getCardPriorities (liveType: LiveType, eventType: EventType): CardPriority[] {
  if (liveType === LiveType.CHALLENGE) return challengeLiveCardPriorities
  if (eventType === EventType.BLOOM) return bloomCardPriorities
  if (eventType === EventType.MARATHON || eventType === EventType.CHEERFUL) return marathonCheerfulCardPriorities
  // 如果都不满足，那就只能都不筛选，所有卡全上
  return [] as CardPriority[]
}

/**
 * 卡牌优先级
 */
export interface CardPriority {
  /**
   * 活动加成下界
   */
  eventBonus: number
  /**
   * 卡牌稀有度
   */
  cardRarityType: string
  /**
   * 突破（专精特训）等级下界
   */
  masterRank: number
  /**
   * 优先级从0开始，优先级越高的数字越低
   */
  priority: number
}
