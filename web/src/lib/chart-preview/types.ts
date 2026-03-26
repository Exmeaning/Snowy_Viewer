export type PreviewRuntimeConfig = {
  mirror: boolean
  flickAnimation: boolean
  holdAnimation: boolean
  simultaneousLine: boolean
  noteSpeed: number
  holdAlpha: number
  guideAlpha: number
  stageOpacity: number
  backgroundBrightness: number
  effectOpacity: number
}

export type UrlPreviewParams = {
  sus: string
  bgm: string | null
  cover: string | null
  rawOffsetMs: number | null
  title: string | null
  lyricist: string | null
  composer: string | null
  arranger: string | null
  vocal: string | null
  difficulty: string | null
  description1: string | null
  description2: string | null
  extra: string | null
}

export type TransportState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'

export type LoadedQuadFrame = {
  count: number
  floats: Float32Array
}

export type HitEventKind = 'tap' | 'criticalTap' | 'flick' | 'trace' | 'tick' | 'holdLoop'

export type HitEvent = {
  timeSec: number
  center: number
  width: number
  kind: HitEventKind
  critical: boolean
  endTimeSec?: number
}

export type HudEventKind = 'tap' | 'criticalTap' | 'flick' | 'trace' | 'tick' | 'holdHalfBeat'

export type HudEvent = {
  timeSec: number
  weight: number
  kind: HudEventKind
  critical: boolean
  halfBeat: boolean
  showJudge: boolean
}

export type SongMetadata = {
  title: string
  artist: string
  designer: string
}

export type HudRuntimeState = {
  score: number
  combo: number
  rank: 'd' | 'c' | 'b' | 'a' | 's'
  scoreBarRatio: number
  scoreDelta: number
  scoreDeltaEventIndex: number
  latestScoreDelta: number
  latestScoreEventIndex: number
  showPerfect: boolean
  lifeRatio: number
}
