export interface UserCard {
  userId: number
  cardId: number
  level: number
  exp?: number
  totalExp: number
  skillLevel: number
  skillExp: number
  totalSkillExp: number
  masterRank: number
  specialTrainingStatus: string
  defaultImage: string
  duplicateCount: number
  createdAt: number
  episodes?: Array<{
    cardEpisodeId: number
    scenarioStatus: string
    scenarioStatusReasons: string[]
    isNotSkipped: boolean
  }>
}
