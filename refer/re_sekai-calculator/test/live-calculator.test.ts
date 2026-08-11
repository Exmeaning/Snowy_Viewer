import { LiveCalculator, LiveType, type DeckDetail } from '../src'
import { TEST_DATA_PROVIDER } from './fixtures/test-data-provider'

const deck = {
  cards: [
    { cardId: 101, skill: { scoreUp: 100, lifeRecovery: 500 } },
    { cardId: 102, skill: { scoreUp: 0, lifeRecovery: 0 } },
    { cardId: 103, skill: { scoreUp: 0, lifeRecovery: 0 } },
    { cardId: 104, skill: { scoreUp: 0, lifeRecovery: 0 } },
    { cardId: 105, skill: { scoreUp: 0, lifeRecovery: 0 } }
  ],
  power: { total: 100000 }
} as unknown as DeckDetail

test('live detail uses deterministic music timing, tap count, power, and life caps', async () => {
  const calculator = new LiveCalculator(TEST_DATA_PROVIDER)
  const music = await calculator.getMusicMeta(1, 'easy')
  const detail = LiveCalculator.getLiveDetailByDeck(deck, music, LiveType.SOLO)

  expect(detail).toEqual({ score: 400000, time: 120, life: 2000, tap: 100 })
  expect(LiveCalculator.getMultiActiveBonus(500000)).toBe(7500)
})
