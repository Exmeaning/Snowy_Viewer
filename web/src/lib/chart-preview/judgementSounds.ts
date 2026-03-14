import type { HitEvent, HitEventKind } from './types'

type SoundKey =
  | 'perfect'
  | 'criticalTap'
  | 'flick'
  | 'flickCritical'
  | 'trace'
  | 'traceCritical'
  | 'tick'
  | 'tickCritical'
  | 'holdLoop'
  | 'holdLoopCritical'

const soundUrls: Record<SoundKey, string> = {
  perfect: '/assets/mmw/sound/se_live_perfect.mp3',
  criticalTap: '/assets/mmw/sound/se_live_critical.mp3',
  flick: '/assets/mmw/sound/se_live_flick.mp3',
  flickCritical: '/assets/mmw/sound/se_live_flick_critical.mp3',
  trace: '/assets/mmw/sound/se_live_trace.mp3',
  traceCritical: '/assets/mmw/sound/se_live_trace_critical.mp3',
  tick: '/assets/mmw/sound/se_live_connect.mp3',
  tickCritical: '/assets/mmw/sound/se_live_connect_critical.mp3',
  holdLoop: '/assets/mmw/sound/se_live_long.mp3',
  holdLoopCritical: '/assets/mmw/sound/se_live_long_critical.mp3',
}

type ActiveLoop = {
  kind: SoundKey
  center: number
  width: number
  critical: boolean
  endTimeSec: number
  source: AudioBufferSourceNode
  gain: GainNode
}

export class JudgementSounds {
  private readonly buffers = new Map<SoundKey, AudioBuffer>()
  private readonly activeLoops = new Set<ActiveLoop>()

  async load(context: AudioContext) {
    await Promise.all(
      (Object.entries(soundUrls) as [SoundKey, string][]).map(async ([key, url]) => {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to load judgement sound: ${response.status} ${response.statusText}`)
        }
        const data = await response.arrayBuffer()
        const buffer = await context.decodeAudioData(data.slice(0))
        this.buffers.set(key, buffer)
      }),
    )
  }

  trigger(context: AudioContext, event: HitEvent, playbackRate: number, currentTimeSec: number) {
    this.cleanupExpiredLoops(currentTimeSec)

    if (event.kind === 'holdLoop' && event.endTimeSec !== undefined && event.endTimeSec > event.timeSec) {
      this.playHoldLoop(context, event, playbackRate, currentTimeSec)
      return
    }

    const key = this.resolveOneShotKey(event.kind, event.critical)
    if (!key) {
      return
    }

    const buffer = this.buffers.get(key)
    if (!buffer) {
      return
    }

    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    source.playbackRate.value = playbackRate
    gain.gain.value = this.getVolume(key)
    source.connect(gain)
    gain.connect(context.destination)
    source.start()
  }

  stopAll() {
    for (const loop of this.activeLoops) {
      loop.source.stop()
      loop.source.disconnect()
      loop.gain.disconnect()
    }
    this.activeLoops.clear()
  }

  private playHoldLoop(context: AudioContext, event: HitEvent, playbackRate: number, currentTimeSec: number) {
    const key: SoundKey = event.critical ? 'holdLoopCritical' : 'holdLoop'
    const buffer = this.buffers.get(key)
    if (!buffer) {
      return
    }

    const existingLoop = [...this.activeLoops].find(
      (loop) =>
        loop.kind === key &&
        loop.critical === event.critical &&
        Math.abs(loop.center - event.center) < 0.001 &&
        Math.abs(loop.width - event.width) < 0.001,
    )
    if (existingLoop) {
      existingLoop.endTimeSec = Math.max(existingLoop.endTimeSec, event.endTimeSec!)
      existingLoop.source.stop(context.currentTime + Math.max((existingLoop.endTimeSec - currentTimeSec) / playbackRate, 0.02))
      return
    }

    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    source.playbackRate.value = playbackRate
    source.loop = true

    const sampleRate = buffer.sampleRate
    const loopPaddingSec = 3000 / sampleRate
    const bufferDuration = buffer.duration
    const loopStart = Math.min(loopPaddingSec, Math.max(0, bufferDuration * 0.45))
    const loopEnd = Math.max(loopStart + 0.01, bufferDuration - loopPaddingSec)
    source.loopStart = loopStart
    source.loopEnd = loopEnd

    gain.gain.value = this.getVolume(key)
    source.connect(gain)
    gain.connect(context.destination)

    const effectiveDuration = Math.max((event.endTimeSec! - currentTimeSec) / playbackRate, 0.02)
    source.start()
    source.stop(context.currentTime + effectiveDuration)

    const activeLoop: ActiveLoop = {
      kind: key,
      center: event.center,
      width: event.width,
      critical: event.critical,
      endTimeSec: event.endTimeSec!,
      source,
      gain,
    }
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      this.activeLoops.delete(activeLoop)
    }
    this.activeLoops.add(activeLoop)
  }

  private cleanupExpiredLoops(currentTimeSec: number) {
    for (const loop of [...this.activeLoops]) {
      if (loop.endTimeSec <= currentTimeSec) {
        loop.source.stop()
      }
    }
  }

  private resolveOneShotKey(kind: HitEventKind, critical: boolean): SoundKey | null {
    if (kind === 'criticalTap') {
      return 'criticalTap'
    }
    if (kind === 'flick') {
      return critical ? 'flickCritical' : 'flick'
    }
    if (kind === 'trace') {
      return critical ? 'traceCritical' : 'trace'
    }
    if (kind === 'tick') {
      return critical ? 'tickCritical' : 'tick'
    }
    if (kind === 'tap') {
      return 'perfect'
    }
    return null
  }

  private getVolume(key: SoundKey) {
    switch (key) {
      case 'perfect':
        return 0.75
      case 'criticalTap':
        return 0.75
      case 'flick':
        return 0.75
      case 'flickCritical':
        return 0.8
      case 'trace':
        return 0.8
      case 'traceCritical':
        return 0.82
      case 'tick':
        return 0.9
      case 'tickCritical':
        return 0.92
      case 'holdLoop':
        return 0.7
      case 'holdLoopCritical':
        return 0.7
    }
  }
}
