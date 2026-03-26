import { CardBloomEventCalculator } from '../src/event-point/card-bloom-event-calculator'
import type { DataProvider } from '../src/data-provider/data-provider'
import type { UserCard } from '../src/user-data/user-card'
import type { Card } from '../src/master-data/card'

const mockSupportDeckBonuses = [
  {
    cardRarityType: 'rarity_4',
    worldBloomSupportDeckCharacterBonuses: [
      { id: 1, worldBloomSupportDeckCharacterType: 'specific', bonusRate: 20 },
      { id: 2, worldBloomSupportDeckCharacterType: 'others', bonusRate: 10 }
    ],
    worldBloomSupportDeckMasterRankBonuses: [
      { id: 1, masterRank: 0, bonusRate: 1 }
    ],
    worldBloomSupportDeckSkillLevelBonuses: [
      { id: 1, skillLevel: 1, bonusRate: 2 }
    ]
  }
]

const mockProvider: DataProvider = {
  async getMasterData<T> (key: string): Promise<T[]> {
    if (key === 'worldBloomSupportDeckBonuses') {
      return mockSupportDeckBonuses as T[]
    }
    if (key === 'worldBloomSupportDeckUnitEventLimitedBonuses') {
      return [] as T[]
    }
    return [] as T[]
  },
  async getUserData<T> (): Promise<T> {
    throw new Error('not used')
  },
  async getUserDataAll (): Promise<Record<string, any>> {
    throw new Error('not used')
  },
  async getMusicMeta () {
    throw new Error('not used')
  }
}

function makeUserCard (): UserCard {
  return {
    userId: 1,
    cardId: 1001,
    level: 60,
    totalExp: 0,
    skillLevel: 1,
    skillExp: 0,
    totalSkillExp: 0,
    masterRank: 0,
    specialTrainingStatus: 'done',
    defaultImage: 'original',
    duplicateCount: 0,
    createdAt: 0
  }
}

function makeCard (characterId: number): Card {
  return {
    id: 1001,
    seq: 1,
    characterId,
    cardRarityType: 'rarity_4',
    specialTrainingPower1BonusFixed: 0,
    specialTrainingPower2BonusFixed: 0,
    specialTrainingPower3BonusFixed: 0,
    attr: 'cool',
    supportUnit: 'none',
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

test('virtual singer support deck bonus does not require matching support unit', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(21),
    ['piapro'],
    { worldBloomSupportUnit: 'leo_need' }
  )
  expect(bonus).toBe(13)
})

test('non virtual singer still requires matching support unit', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(1),
    ['leo_need'],
    { worldBloomSupportUnit: 'more_more_jump' }
  )
  expect(bonus).toBeUndefined()
})
