import { TestDataProvider } from './data-provider.test'
import { DeckCalculator, DeckService } from '../src'

const deckService = new DeckService(TestDataProvider.INSTANCE)
const deckCalculator = new DeckCalculator(TestDataProvider.INSTANCE)
// 选一个卡组算数据，测试数据是263805综合、[80,80,100,40,40]加分、[0,0,0,0,250]回复
test('deck', async () => {
  const scoreUp = [100, 85, 80, 80, 80]
  const lifeRecovery = [0, 0, 0, 0, 0]
  const deck = await deckService.getDeckCards(await deckService.getDeck(1))
  await deckCalculator.getDeckDetail(deck, deck).then(it => {
    // console.log(it.cards)
    expect(it.power.total).toBe(276977)
    it.cards.forEach((it, i) => {
      expect(it.skill.scoreUp).toBe(scoreUp[i])
      expect(it.skill.lifeRecovery).toBe(lifeRecovery[i])
    })
  })
})
