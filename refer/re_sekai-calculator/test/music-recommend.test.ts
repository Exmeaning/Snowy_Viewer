import { DeckCalculator, DeckService, EventType, LiveType, MusicRecommend } from '../src'
import { TestDataProvider } from './data-provider.test'
import { getOrThrow } from '../src/util/collection-util'

const deckService = new DeckService(TestDataProvider.INSTANCE)
const deckCalculator = new DeckCalculator(TestDataProvider.INSTANCE)
const musicRecommend = new MusicRecommend(TestDataProvider.INSTANCE)

test('challenge', async () => {
  const deck = await deckService.getChallengeLiveSoloDeckCards(await deckService.getChallengeLiveSoloDeck(24))
  const deckDetail = await deckCalculator.getDeckDetail(deck, deck)
  let recommend = await musicRecommend.recommendMusic(deckDetail, LiveType.CHALLENGE, EventType.NONE)
  recommend = recommend.sort((a, b) =>
    getOrThrow(b.liveScore, LiveType.CHALLENGE) - getOrThrow(a.liveScore, LiveType.CHALLENGE))
  // console.log(recommend.slice(0, 3))
  expect(getOrThrow(recommend[0].liveScore, LiveType.CHALLENGE)).toBeGreaterThanOrEqual(2200000)
})
