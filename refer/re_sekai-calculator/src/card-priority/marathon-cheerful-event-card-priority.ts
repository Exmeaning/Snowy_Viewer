import { type CardPriority } from './card-priority-filter'

/**
 * 卡牌稀有度顺序，用于马拉松、欢乐嘉年华
 */
export const marathonCheerfulCardPriorities: CardPriority[] = [
  {
    eventBonus: 25 + 25 + 20 + 25, // 同色同队 当期卡 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 0
  }, {
    eventBonus: 25 + 25 + 20 + 10, // 同色同队 当期卡 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 10
  }, {
    eventBonus: 25 + 25 + 25, // 同色同队 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 10
  }, {
    eventBonus: 25 + 15 + 25, // 同色同队（V家） 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 30
  }, {
    eventBonus: 25 + 25 + 10, // 同色同队 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 40
  }, {
    eventBonus: 25 + 25, // 同色或同队 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 40
  }, {
    eventBonus: 25 + 25 + 15,
    cardRarityType: 'rarity_birthday',
    masterRank: 5,
    priority: 40
  }, {
    eventBonus: 25 + 15 + 10, // 同色同队（V家） 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 50
  }, {
    eventBonus: 25 + 25 + 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 50
  }, {
    eventBonus: 25 + 25 + 5,
    cardRarityType: 'rarity_3',
    masterRank: 5,
    priority: 50
  }, {
    eventBonus: 25 + 10, // 同色或同队 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 60
  }, {
    eventBonus: 25 + 15,
    cardRarityType: 'rarity_birthday',
    masterRank: 5,
    priority: 60
  }, {
    eventBonus: 25 + 25,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 60
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 60
  }, {
    eventBonus: 15 + 10,
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 25 + 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 25 + 5,
    cardRarityType: 'rarity_3',
    masterRank: 5,
    priority: 70
  }, {
    eventBonus: 25 + 25,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 25 + 25,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 15 + 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 10,
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 100
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 100
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 100
  }
]
