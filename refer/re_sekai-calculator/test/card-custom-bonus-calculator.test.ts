import { CardCustomBonusCalculator } from '../src/card-information/card-custom-bonus-calculator'
import { type CustomBonusConfig } from '../src/common/custom-bonus'
import { type Card } from '../src/master-data/card'

function makeCard ({
  characterId = 21,
  supportUnit = 'none',
  attr = 'cool'
}: {
  characterId?: number
  supportUnit?: string
  attr?: string
} = {}): Card {
  return {
    id: 1001,
    seq: 1,
    characterId,
    cardRarityType: 'rarity_4',
    specialTrainingPower1BonusFixed: 0,
    specialTrainingPower2BonusFixed: 0,
    specialTrainingPower3BonusFixed: 0,
    attr,
    supportUnit,
    skillId: 1,
    cardSkillName: 'test',
    prefix: 'test',
    assetbundleName: 'test',
    gachaPhrase: '',
    flavorText: '',
    releaseAt: 0,
    cardParameters: [],
    specialTrainingCosts: [],
    masterLessonAchieveResources: {
      releaseConditionId: 0,
      cardId: 1001,
      masterRank: 0,
      resources: []
    }
  }
}

test('virtual singer with attached support unit gets both unit and attr custom bonus', () => {
  const card = makeCard({
    characterId: 21,
    supportUnit: 'idol',
    attr: 'cool'
  })
  const customBonuses: CustomBonusConfig = {
    rules: [
      { unit: 'more_more_jump', bonusRate: 25 },
      { unit: 'any', attr: 'cool', bonusRate: 25 }
    ]
  }

  expect(CardCustomBonusCalculator.getCustomBonusRate(card, customBonuses)).toBe(50)
})

test('original virtual singer still matches any non piapro unit plus attr', () => {
  const card = makeCard({
    characterId: 21,
    supportUnit: 'none',
    attr: 'cool'
  })
  const customBonuses: CustomBonusConfig = {
    rules: [
      { unit: 'more_more_jump', bonusRate: 25 },
      { unit: 'any', attr: 'cool', bonusRate: 25 }
    ]
  }

  expect(CardCustomBonusCalculator.getCustomBonusRate(card, customBonuses)).toBe(50)
})

test('character exact rule supports supportUnit alias matching', () => {
  const card = makeCard({
    characterId: 21,
    supportUnit: 'idol',
    attr: 'cool'
  })
  const customBonuses: CustomBonusConfig = {
    rules: [
      { unit: 'any', characterId: 21, supportUnit: 'more_more_jump', bonusRate: 25 }
    ]
  }

  expect(CardCustomBonusCalculator.getCustomBonusRate(card, customBonuses)).toBe(25)
})

test('non virtual singer unit matching supports alias unit names', () => {
  const card = makeCard({
    characterId: 5,
    supportUnit: 'none',
    attr: 'cute'
  })
  const customBonuses: CustomBonusConfig = {
    rules: [
      { unit: 'idol', bonusRate: 25 }
    ]
  }

  expect(CardCustomBonusCalculator.getCustomBonusRate(card, customBonuses)).toBe(25)
})
