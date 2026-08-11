import {
  BaseDeckRecommend,
  BloomSupportDeckRecommend,
  ChallengeLiveDeckRecommend,
  DeckService,
  EventBonusDeckRecommend,
  EventDeckRecommend,
  LiveType,
  RecommendAlgorithm,
  RecommendTarget,
  type DeckCardDetail,
  type UserCard
} from '../src'
import { TEST_DATA_PROVIDER } from './fixtures/test-data-provider'

const cards = Array.from({ length: 5 }, (_, index) => ({ cardId: 101 + index })) as DeckCardDetail[]

test('recommended card output converts to stable deck contracts', () => {
  expect(DeckService.toUserDeck(cards, 9000000001, 7, 'Synthetic')).toMatchObject({
    userId: 9000000001,
    deckId: 7,
    leader: 101,
    subLeader: 102,
    member5: 105
  })
  expect(DeckService.toUserChallengeLiveSoloDeck(cards, 1)).toEqual({
    characterId: 1,
    leader: 101,
    support1: 102,
    support2: 103,
    support3: 104,
    support4: 105
  })
})

test('deck conversion rejects invalid card counts', () => {
  expect(() => DeckService.toUserDeck(cards.slice(0, 4))).toThrow('deck card should be 5')
  expect(() => DeckService.toUserChallengeLiveSoloDeck([], 1)).toThrow('deck card should >= 1')
})

async function getFixtureInput () {
  return {
    musicMeta: (await TEST_DATA_PROVIDER.getMusicMeta())[0],
    userCards: await TEST_DATA_PROVIDER.getUserData<UserCard[]>('userCards')
  }
}

test('base recommendation selects the strongest valid five-character deck', async () => {
  const { musicMeta, userCards } = await getFixtureInput()
  const result = await new BaseDeckRecommend(TEST_DATA_PROVIDER).recommendHighScoreDeck(
    userCards,
    () => 0,
    {
      musicMeta,
      algorithm: RecommendAlgorithm.DFS,
      target: RecommendTarget.Power,
      timeoutMs: 5000
    },
    LiveType.MULTI
  )

  expect(result).toHaveLength(1)
  expect(result[0].cards.map(it => it.cardId).sort((a, b) => a - b)).toEqual([103, 104, 105, 106, 107])
  expect(result[0].score).toBe(result[0].power.total)
})

test('challenge recommendation keeps cards for the requested character', async () => {
  const { musicMeta } = await getFixtureInput()
  const result = await new ChallengeLiveDeckRecommend(TEST_DATA_PROVIDER).recommendChallengeLiveDeck(1, {
    musicMeta,
    member: 2,
    algorithm: RecommendAlgorithm.DFS,
    timeoutMs: 5000
  })

  expect(result).toHaveLength(1)
  expect(result[0].cards.map(it => it.cardId).sort((a, b) => a - b)).toEqual([101, 107])
  expect(result[0].score).toBeGreaterThan(0)
})

test('event recommendation returns a scored deck with fixture bonuses', async () => {
  const { musicMeta } = await getFixtureInput()
  const result = await new EventDeckRecommend(TEST_DATA_PROVIDER).recommendEventDeck(
    100,
    LiveType.MULTI,
    {
      musicMeta,
      algorithm: RecommendAlgorithm.DFS,
      timeoutMs: 5000
    }
  )

  expect(result).toHaveLength(1)
  expect(result[0].cards).toHaveLength(5)
  expect(result[0].eventBonus).toBeGreaterThanOrEqual(125)
  expect(result[0].score).toBeGreaterThan(0)
})

test('world bloom recommendation and support recommendation agree', async () => {
  const { musicMeta } = await getFixtureInput()
  const eventRecommend = new EventDeckRecommend(TEST_DATA_PROVIDER)
  const result = await eventRecommend.recommendEventDeck(
    101,
    LiveType.MULTI,
    {
      musicMeta,
      algorithm: RecommendAlgorithm.DFS,
      timeoutMs: 5000
    },
    1
  )

  expect(result).toHaveLength(1)
  expect(result[0].eventBonus).toBe(120)
  expect(result[0].supportDeckBonus).toBeGreaterThan(0)

  const supportCards = await new BloomSupportDeckRecommend(TEST_DATA_PROVIDER)
    .recommendBloomSupportDeck(result[0].cards, 101, 1)
  expect(supportCards.reduce((sum, card) => sum + (card.supportDeckBonus ?? 0), 0))
    .toBe(result[0].supportDeckBonus)
})

test('event bonus recommendation finds an exact deterministic target', async () => {
  const { musicMeta } = await getFixtureInput()
  const result = await new EventBonusDeckRecommend(TEST_DATA_PROVIDER).recommendEventBonusDeck(
    100,
    150,
    LiveType.MULTI,
    { musicMeta, timeoutMs: 5000 }
  )

  expect(result).toHaveLength(1)
  expect(result[0].score).toBe(150)
  expect(result[0].eventBonus).toBe(150)
  expect(result[0].cards.map(it => it.cardId).sort((a, b) => a - b)).toEqual([101, 102, 103, 104, 105])
})
