export interface IngameJudgeFrame {
  id: number
  ingameNoteType: string
  perfect?: number
  great?: number
  good?: number
  bad?: number
  perfectBefore: number
  perfectAfter: number
  greatBefore: number
  greatAfter: number
  goodBefore: number
  goodAfter: number
  badBefore: number
  badAfter: number
}
