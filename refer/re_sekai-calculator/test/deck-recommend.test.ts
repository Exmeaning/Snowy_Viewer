import { DeckService, type DeckCardDetail } from '../src'

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
