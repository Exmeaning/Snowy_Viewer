import { AreaItemRecommend, DeckService } from '../src'
import { TestDataProvider } from './data-provider.test'

const deckService = new DeckService(TestDataProvider.INSTANCE)
const areaItemRecommend = new AreaItemRecommend(TestDataProvider.INSTANCE)

test('area item recommend', async () => {
  const deck =
    await deckService.getChallengeLiveSoloDeckCards(await deckService.getChallengeLiveSoloDeck(24))
  const recommend = await areaItemRecommend.recommendAreaItem(deck)
  // console.log(recommend.slice(0, 3))
  expect(recommend.length).toBeGreaterThan(0)
})
