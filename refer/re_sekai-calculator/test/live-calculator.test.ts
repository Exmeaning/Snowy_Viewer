import { TestDataProvider } from './data-provider.test'
import { LiveCalculator, LiveType, DeckService } from '../src'

const liveCalculator = new LiveCalculator(TestDataProvider.INSTANCE)
const deckService = new DeckService(TestDataProvider.INSTANCE)

// LUKA卡组回复量为0，分数不好说
test('solo', async () => {
  const deck = await deckService.getChallengeLiveSoloDeckCards(await deckService.getChallengeLiveSoloDeck(24))
  await liveCalculator.getLiveDetail(
    deck, await liveCalculator.getMusicMeta(104, 'master'), LiveType.SOLO).then(it => {
    expect(it.life).toBe(1000)
    expect(it.tap).toBe(533)
    expect(it.time).toBe(117.6)
    expect(it.score).toBeGreaterThan(2200000)
  })
})

// 多人卡组无回复
test('multi', async () => {
  const deck = await deckService.getDeckCards(await deckService.getDeck(1))
  await liveCalculator.getLiveDetail(
    deck, await liveCalculator.getMusicMeta(1, 'easy'), LiveType.MULTI).then(it => {
    expect(it.life).toBe(1000)
    expect(it.tap).toBe(76)
    expect(it.time).toBe(123.2)
    expect(it.score).toBeGreaterThan(1000000)
  })
})
