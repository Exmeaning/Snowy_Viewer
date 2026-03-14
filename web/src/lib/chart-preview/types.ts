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
  rawOffsetMs: number | null
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
