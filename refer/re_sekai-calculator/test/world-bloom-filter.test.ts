import { EventType, type EventConfig } from '../src/event-point/event-service'
import {
  getMainDeckFilterUnit,
  shouldApplySameUnitOrAttrPrune,
  shouldKeepCardForMainDeckFilter,
  type MainDeckFilterCard
} from '../src/deck-recommend/world-bloom-filter'

function makeCard (characterId: number, units: string[]): MainDeckFilterCard {
  return { characterId, units }
}

test('mixed world bloom ignores support unit when filtering main deck', () => {
  const eventConfig: EventConfig = {
    eventType: EventType.BLOOM,
    worldBloomSupportUnit: 'piapro',
    specialCharacterId: 21
  }

  const filterUnit = getMainDeckFilterUnit(eventConfig)
  const cards = [
    makeCard(21, ['piapro']),
    makeCard(6, ['more_more_jump']),
    makeCard(17, ['nightcord_at_25'])
  ]
  const filtered = cards.filter(it => shouldKeepCardForMainDeckFilter(it, filterUnit))

  expect(filterUnit).toBeUndefined()
  expect(filtered.map(it => it.characterId)).toEqual([21, 6, 17])
  expect(shouldApplySameUnitOrAttrPrune(eventConfig)).toBe(false)
})

test('single-unit world bloom still filters by event unit', () => {
  const eventConfig: EventConfig = {
    eventType: EventType.BLOOM,
    eventUnit: 'leo_need',
    worldBloomSupportUnit: 'piapro',
    specialCharacterId: 21
  }

  const filterUnit = getMainDeckFilterUnit(eventConfig)
  const cards = [
    makeCard(21, ['piapro']),
    makeCard(1, ['leo_need']),
    makeCard(6, ['more_more_jump']),
    makeCard(14, ['wonderlands_showtime'])
  ]
  const filtered = cards.filter(it => shouldKeepCardForMainDeckFilter(it, filterUnit))

  expect(filterUnit).toBe('leo_need')
  expect(filtered.map(it => it.characterId)).toEqual([21, 1])
  expect(shouldApplySameUnitOrAttrPrune(eventConfig)).toBe(true)
})

test('fixed characters still bypass single-unit world bloom filtering', () => {
  const eventConfig: EventConfig = {
    eventType: EventType.BLOOM,
    eventUnit: 'leo_need',
    worldBloomSupportUnit: 'piapro',
    specialCharacterId: 21
  }

  const filterUnit = getMainDeckFilterUnit(eventConfig)
  const cards = [
    makeCard(21, ['piapro']),
    makeCard(1, ['leo_need']),
    makeCard(6, ['more_more_jump'])
  ]
  const filtered = cards.filter(it => shouldKeepCardForMainDeckFilter(it, filterUnit, new Set([6])))

  expect(filtered.map(it => it.characterId)).toEqual([21, 1, 6])
})
