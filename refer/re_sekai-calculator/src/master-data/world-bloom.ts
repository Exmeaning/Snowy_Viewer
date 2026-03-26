export interface WorldBloom {
  id: number
  eventId: number
  gameCharacterId: number
  worldBloomChapterType: string // game_character, finale
  chapterNo: number
  chapterStartAt: number
  aggregateAt: number
  chapterEndAt: number
  isSupplemental: boolean
}
