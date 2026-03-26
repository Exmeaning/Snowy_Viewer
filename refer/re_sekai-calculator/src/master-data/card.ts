import type { CommonResource } from '../common/resource'

export interface Card {
  id: number
  seq: number
  characterId: number
  cardRarityType: string
  specialTrainingPower1BonusFixed: number
  specialTrainingPower2BonusFixed: number
  specialTrainingPower3BonusFixed: number
  attr: string
  supportUnit: string
  skillId: number
  cardSkillName: string
  specialTrainingSkillId?: number
  specialTrainingSkillName?: string
  prefix: string
  assetbundleName: string
  gachaPhrase: string
  flavorText: string
  releaseAt: number
  cardParameters: Array<{
    id: number
    cardId: number
    cardLevel: number
    cardParameterType: string
    power: number
  }>
  specialTrainingCosts: Array<{
    cardId: number
    seq: number
    cost: CommonResource
  }>
  masterLessonAchieveResources: {
    releaseConditionId: number
    cardId: number
    masterRank: number
    resources: CommonResource[]
  }
}
