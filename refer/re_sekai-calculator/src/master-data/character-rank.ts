import { type CommonResource } from '../common/resource'

export interface CharacterRank {
  id: number
  characterId: number
  characterRank: number
  power1BonusRate: number
  power2BonusRate: number
  power3BonusRate: number
  rewardResourceBoxIds: number[]
  characterRankAchieveResources: Array<{
    releaseConditionId: number
    characterId: number
    characterRank: number
    resources: CommonResource[]
  }>
}
