import { EventType } from '../src/event-point/event-service'
import { LiveType } from '../src/live-score/live-calculator'
import { filterCardPriority } from '../src/card-priority/card-priority-filter'
import { type CardDetail } from '../src/card-information/card-calculator'

function makeCard ({
  cardId,
  characterId,
  units,
  attr,
  rarity = 'rarity_4',
  masterRank = 0,
  maxBonus = 35
}: {
  cardId: number
  characterId: number
  units: string[]
  attr: string
  rarity?: string
  masterRank?: number
  maxBonus?: number
}): CardDetail {
  return {
    cardId,
    characterId,
    units,
    attr,
    cardRarityType: rarity,
    masterRank,
    eventBonus: {
      getMaxBonus: () => maxBonus
    }
  } as unknown as CardDetail
}

test('world bloom priority filter keeps expanding when pool can form a unit but not five attrs', () => {
  const highPriorityCards = [
    makeCard({ cardId: 101, characterId: 1, units: ['leo_need'], attr: 'cool' }),
    makeCard({ cardId: 102, characterId: 2, units: ['leo_need'], attr: 'cute' }),
    makeCard({ cardId: 103, characterId: 3, units: ['leo_need'], attr: 'happy' }),
    makeCard({ cardId: 104, characterId: 4, units: ['leo_need'], attr: 'mysterious' }),
    makeCard({ cardId: 105, characterId: 5, units: ['leo_need'], attr: 'cool' })
  ]
  const lowerPriorityCard = makeCard({
    cardId: 201,
    characterId: 6,
    units: ['more_more_jump'],
    attr: 'pure',
    rarity: 'rarity_3',
    maxBonus: 0
  })

  const filtered = filterCardPriority(
    LiveType.MULTI,
    EventType.BLOOM,
    [...highPriorityCards, lowerPriorityCard],
    [],
    5
  )

  expect(filtered.map(it => it.cardId)).toEqual([101, 102, 103, 104, 105, 201])
})

test('world bloom priority filter may stop once pool already covers five attrs even without five-person unit', () => {
  const highPriorityCards = [
    makeCard({ cardId: 111, characterId: 1, units: ['leo_need'], attr: 'cool' }),
    makeCard({ cardId: 112, characterId: 2, units: ['leo_need'], attr: 'cute' }),
    makeCard({ cardId: 113, characterId: 3, units: ['leo_need'], attr: 'happy' }),
    makeCard({ cardId: 114, characterId: 4, units: ['leo_need'], attr: 'mysterious' }),
    makeCard({ cardId: 115, characterId: 5, units: ['more_more_jump'], attr: 'pure' })
  ]
  const lowerPriorityCard = makeCard({
    cardId: 211,
    characterId: 6,
    units: ['leo_need'],
    attr: 'pure',
    rarity: 'rarity_3',
    maxBonus: 0
  })

  const filtered = filterCardPriority(
    LiveType.MULTI,
    EventType.BLOOM,
    [...highPriorityCards, lowerPriorityCard],
    [],
    5
  )

  expect(filtered.map(it => it.cardId)).toEqual([111, 112, 113, 114, 115])
})
