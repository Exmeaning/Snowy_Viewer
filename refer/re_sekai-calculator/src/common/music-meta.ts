export interface MusicMeta {
  music_id: number
  difficulty: string
  music_time: number
  event_rate: number
  base_score: number
  base_score_auto: number
  skill_score_solo: number[]
  skill_score_auto: number[]
  skill_score_multi: number[]
  fever_score: number
  fever_end_time: number
  tap_count: number
}
