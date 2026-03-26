import { type CardPriority } from './card-priority-filter'

/**
 * 卡牌稀有度顺序，用于World Link
 */
export const bloomCardPriorities: CardPriority[] = [
  {
    eventBonus: 25 + 10 + 20, // 同队 四星 当期
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 0
  },
  {
    eventBonus: 25 + 25, // 同队 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 5
  },
  {
    eventBonus: 25 + 10, // 同队 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 10
  }, {
    eventBonus: 25 + 15, // 同队 5破生日
    cardRarityType: 'rarity_birthday',
    masterRank: 5,
    priority: 10
  }, {
    eventBonus: 25 + 5, // 同队 0破生日
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 20
  }, {
    eventBonus: 25 + 5, // 同队 5破三星
    cardRarityType: 'rarity_3',
    masterRank: 5,
    priority: 20
  }, {
    eventBonus: 25, // 异队 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 21
  }, {
    eventBonus: 10, // 异队 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 22
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 30
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 40
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 50
  }, {
    eventBonus: 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 100
  }
]
