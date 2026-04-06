import { type EventConfig, EventType } from '../event-point/event-service'

export interface MainDeckFilterCard {
  characterId: number
  units: string[]
}

/**
 * 主卡组候选池的团体过滤。
 *
 * 只对真正的单团体 World Bloom 生效；
 * 混团 WL / WL3 模拟时即使选择了支援角色，也不能按支援角色所属团体过滤主卡池。
 */
export function getMainDeckFilterUnit (eventConfig: EventConfig): string | undefined {
  if (eventConfig.eventType !== EventType.BLOOM) return undefined
  return eventConfig.eventUnit
}

/**
 * “必须和当前核心卡同色或同组” 的 DFS 剪枝是否可以启用。
 *
 * 混团 World Bloom 没有固定团体约束，启用这条剪枝会过早剪掉跨团体最优解。
 */
export function shouldApplySameUnitOrAttrPrune (eventConfig: EventConfig): boolean {
  return eventConfig.eventType !== EventType.BLOOM || eventConfig.eventUnit !== undefined
}

/**
 * 判断一张卡是否应该保留在主卡组候选池中。
 */
export function shouldKeepCardForMainDeckFilter (
  card: MainDeckFilterCard,
  filterUnit: string | undefined,
  fixedCharacterSet: ReadonlySet<number> = new Set<number>()
): boolean {
  if (filterUnit === undefined) return true

  return fixedCharacterSet.has(card.characterId) ||
    (card.units.length === 1 && card.units[0] === 'piapro') ||
    card.units.includes(filterUnit)
}
