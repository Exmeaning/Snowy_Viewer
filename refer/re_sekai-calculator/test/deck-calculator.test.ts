import { DeckCalculator, type CardDetail } from '../src'

function card (cardId: number, scoreUp: number): CardDetail {
  return {
    cardId,
    level: 10,
    skillLevel: 1,
    masterRank: 0,
    attr: 'cool',
    units: ['unit_a'],
    defaultImage: 'special_training',
    power: {
      getPower: () => ({ base: 10000, areaItemBonus: 0, characterBonus: 0, fixtureBonus: 0, gateBonus: 0, total: 10000 })
    },
    skill: {
      hasPreTraining: false,
      getSkill: () => ({ skillId: cardId, isAfterTraining: true, scoreUpFixed: scoreUp, scoreUpToReference: scoreUp, lifeRecovery: 0 })
    }
  } as unknown as CardDetail
}

test('deck detail deterministically sums power and selects the strongest leader', () => {
  const cards = [card(101, 40), card(102, 80), card(103, 60), card(104, 50), card(105, 70)]
  const detail = DeckCalculator.getDeckDetailByCards(cards, cards, 100)

  expect(detail.power).toEqual({
    base: 50000,
    areaItemBonus: 0,
    characterBonus: 0,
    honorBonus: 100,
    fixtureBonus: 0,
    gateBonus: 0,
    total: 50100
  })
  expect(detail.cards[0].cardId).toBe(102)
  expect(detail.cards.map(it => it.skill.scoreUp)).toEqual([80, 40, 60, 50, 70])
})
