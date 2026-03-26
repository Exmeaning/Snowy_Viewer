import { type CardPriority } from './card-priority-filter'

/**
 * 卡牌稀有度顺序，用于挑战Live
 */
export const challengeLiveCardPriorities: CardPriority[] = [
  {
    eventBonus: 0,
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 0
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 10
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 20
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 30
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 40
  }
]
