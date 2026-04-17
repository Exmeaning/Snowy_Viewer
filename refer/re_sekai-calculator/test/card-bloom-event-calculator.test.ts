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

// ========== VS card with matching support unit ==========

test('VS card with matching support unit gets bonus', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  // Miku card tagged with nightcord_at_25 (25h应援), support is nightcord_at_25
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(21),
    ['piapro', 'nightcord_at_25'],
    { worldBloomSupportUnit: 'nightcord_at_25' }
  )
  expect(bonus).toBe(13) // 10 (others) + 1 (masterRank) + 2 (skillLevel)
})

// ========== VS card without matching support unit ==========

test('VS card without matching support unit is excluded', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  // Miku piapro-only card, support is leo_need → excluded
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(21),
    ['piapro'],
    { worldBloomSupportUnit: 'leo_need' }
  )
  expect(bonus).toBeUndefined()
})

// ========== Non-VS card requires matching support unit ==========

test('non-VS card with mismatched unit is excluded', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(1),
    ['leo_need'],
    { worldBloomSupportUnit: 'more_more_jump' }
  )
  expect(bonus).toBeUndefined()
})

test('non-VS card with matching unit gets bonus', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(1),
    ['leo_need'],
    { worldBloomSupportUnit: 'leo_need' }
  )
  expect(bonus).toBe(13)
})

// ========== VS support character (piapro) ==========

test('VS support character: all VS cards included (piapro matches)', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  // Support is Miku (piapro), another VS card with piapro unit → included
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(22), // Rin
    ['piapro'],
    { worldBloomSupportUnit: 'piapro' }
  )
  expect(bonus).toBe(13)
})

test('VS support character: non-VS cards excluded (no piapro unit)', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  // Support is Miku (piapro), human character card → excluded
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(1),
    ['leo_need'],
    { worldBloomSupportUnit: 'piapro' }
  )
  expect(bonus).toBeUndefined()
})

// ========== No support unit specified ==========

test('no worldBloomSupportUnit returns undefined', async () => {
  const calculator = new CardBloomEventCalculator(mockProvider)
  const bonus = await calculator.getCardSupportDeckBonus(
    makeUserCard(),
    makeCard(21),
    ['piapro'],
    {}
  )
  expect(bonus).toBeUndefined()
})
