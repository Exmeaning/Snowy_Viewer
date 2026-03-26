import { type CommonResource } from '../common/resource'

export interface MasterLesson {
  cardRarityType: string
  masterRank: number
  power1BonusFixed: number
  power2BonusFixed: number
  power3BonusFixed: number
  characterRankExp: number
  costs: CommonResource[]
  rewards: CommonResource[]
}
