import { EventType, LiveType, MusicRecommend, type DeckDetail } from '../src'
import { TEST_DATA_PROVIDER } from './fixtures/test-data-provider'

const deck = {
  cards: Array.from({ length: 5 }, (_, index) => ({ cardId: 101 + index, skill: { scoreUp: 0, lifeRecovery: 0 } })),
  power: { total: 100000 }
} as unknown as DeckDetail

test('music recommendation scores every deterministic music fixture', async () => {
  const recommendations = await new MusicRecommend(TEST_DATA_PROVIDER)
    .recommendMusic(deck, LiveType.CHALLENGE, EventType.NONE)

  expect(recommendations.map(it => it.musicId)).toEqual([1, 2])
  expect(recommendations.map(it => it.liveScore.get(LiveType.CHALLENGE))).toEqual([400000, 480000])
  expect(recommendations.every(it => it.eventPoint.has(LiveType.CHALLENGE))).toBe(true)
})
