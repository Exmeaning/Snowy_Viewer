import type { TransportState } from './types'

type Listener = () => void

export class AudioTransport {
  private audioContext: AudioContext | null = null
  private audioBuffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private state: TransportState = 'idle'
  private playbackRate = 1
  private baseTimeSec = 0
  private startedAtAudioTime = 0
  private startedAtWallTime = 0
  private durationSec = 0
  private bgmOffsetSec = 0
  private audioStartOffsetSec = 0
  private volume = 0.8
  private pendingGestureStart = false
  private readonly listeners = new Set<Listener>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot() {
    const currentTimeSec = this.getCurrentTimeSec()
    return {
      state: this.state,
      currentTimeSec,
      durationSec: this.durationSec,
      playbackRate: this.playbackRate,
      requiresGesture: this.pendingGestureStart,
      hasAudio: !!this.audioBuffer,
    }
  }

  setLoading() {
    this.state = 'loading'
    this.emit()
  }

  setReady() {
    this.state = 'ready'
    this.emit()
  }

  setError() {
    this.state = 'error'
    this.emit()
  }

  setDuration(durationSec: number) {
    this.durationSec = Math.max(durationSec, 0)
    this.baseTimeSec = Math.min(this.baseTimeSec, this.durationSec)
    this.emit()
  }

  async setAudioData(data: ArrayBuffer | null) {
    if (!data) {
      this.audioBuffer = null
      this.emit()
      return
    }

    const context = this.getOrCreateAudioContext()
    this.audioBuffer = await context.decodeAudioData(data.slice(0))
    // Effective duration = raw audio duration minus the leading offset we skip
    const effectiveAudioDuration = Math.max(0, this.audioBuffer.duration - this.bgmOffsetSec)
    this.durationSec = Math.max(this.durationSec, effectiveAudioDuration)
    this.emit()
  }

  /** Set how many seconds to skip at the start of the BGM audio file. */
  setBgmOffsetSec(sec: number) {
    this.bgmOffsetSec = Math.max(sec, 0)
  }

  /** Set how many seconds to delay audio playback relative to transport time 0. */
  setAudioStartOffset(sec: number) {
    this.audioStartOffsetSec = Math.max(sec, 0)
  }

  setVolume(vol: number) {
    this.volume = Math.min(Math.max(vol, 0), 1)
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume
    }
  }

  getAudioContext() {
    return this.getOrCreateAudioContext()
  }

  async unlock() {
    const context = this.getOrCreateAudioContext()
    await context.resume()
    if (this.pendingGestureStart) {
      this.pendingGestureStart = false
      this.startPlayback()
    }
    this.emit()
  }

  async play() {
    if (this.state === 'playing') {
      return true
    }

    if (this.audioBuffer) {
      const context = this.getOrCreateAudioContext()
      if (context.state !== 'running') {
        try {
          await context.resume()
        } catch {
          this.pendingGestureStart = true
          this.emit()
          return false
        }
      }
    }

    this.startPlayback()
    return true
  }

  pause() {
    if (this.state !== 'playing') {
      return
    }
    this.baseTimeSec = this.getCurrentTimeSec()
    this.stopSource()
    this.state = 'paused'
    this.emit()
  }

  stop() {
    this.stopSource()
    this.baseTimeSec = 0
    this.pendingGestureStart = false
    this.state = 'paused'
    this.emit()
  }

  seek(timeSec: number) {
    const clamped = this.clampTime(timeSec)
    const wasPlaying = this.state === 'playing'
    this.baseTimeSec = clamped
    if (wasPlaying) {
      this.stopSource()
      this.startPlayback()
    } else {
      this.emit()
    }
  }

  async setPlaybackRate(rate: number) {
    this.playbackRate = rate
    if (this.state === 'playing') {
      this.baseTimeSec = this.getCurrentTimeSec()
      this.stopSource()
      this.startPlayback()
    } else {
      this.emit()
    }
  }

  getCurrentTimeSec() {
    if (this.state !== 'playing') {
      return this.baseTimeSec
    }

    let current = this.baseTimeSec
    if (this.audioBuffer && this.audioContext) {
      current += (this.audioContext.currentTime - this.startedAtAudioTime) * this.playbackRate
    } else {
      current += ((performance.now() - this.startedAtWallTime) / 1000) * this.playbackRate
    }

    if (current >= this.durationSec && this.durationSec > 0) {
      this.baseTimeSec = this.durationSec
      this.stopSource()
      this.state = 'paused'
      this.emit()
      return this.baseTimeSec
    }

    return current
  }

  private startPlayback() {
    this.baseTimeSec = this.clampTime(this.baseTimeSec)
    this.startedAtWallTime = performance.now()
    this.startedAtAudioTime = this.audioContext?.currentTime ?? 0
    this.stopSource()
    if (this.audioBuffer && this.audioContext) {
      // audioTimeSec = how far into the logical audio stream we should be
      // (0 = the moment the actual music content starts, after filler)
      const audioTimeSec = this.baseTimeSec - this.audioStartOffsetSec
      // When audioTimeSec >= 0, we're past the audio start point:
      //   sourceOffsetSec = audioTimeSec + bgmOffsetSec (skip filler + seek to position)
      // When audioTimeSec < 0, we haven't reached the audio start yet:
      //   We delay playback and start from bgmOffsetSec (right after filler)
      const startDelaySec = audioTimeSec < 0 ? (-audioTimeSec) / Math.max(this.playbackRate, 0.01) : 0
      const sourceOffsetSec = audioTimeSec < 0
        ? this.bgmOffsetSec
        : audioTimeSec + this.bgmOffsetSec
      if (sourceOffsetSec < this.audioBuffer.duration) {
        const source = this.audioContext.createBufferSource()
        source.buffer = this.audioBuffer
        source.playbackRate.value = this.playbackRate
        this.gainNode ??= this.audioContext.createGain()
        this.gainNode.gain.value = this.volume
        source.connect(this.gainNode)
        this.gainNode.connect(this.audioContext.destination)
        source.onended = () => {
          if (this.source === source && this.state === 'playing') {
            const currentTimeSec = Math.min(this.durationSec, this.getCurrentTimeSec())
            this.source = null
            this.baseTimeSec = currentTimeSec
            if (currentTimeSec < this.durationSec) {
              this.startedAtWallTime = performance.now()
              this.startedAtAudioTime = this.audioContext?.currentTime ?? 0
              this.emit()
              return
            }
            this.state = 'paused'
            this.emit()
          }
        }
        source.start(this.audioContext.currentTime + startDelaySec, sourceOffsetSec)
        this.source = source
        this.startedAtAudioTime = this.audioContext.currentTime
      }
    }

    this.state = 'playing'
    this.emit()
  }

  private stopSource() {
    if (!this.source) {
      return
    }
    this.source.onended = null
    this.source.stop()
    this.source.disconnect()
    this.source = null
  }

  private clampTime(timeSec: number) {
    return this.durationSec > 0 ? Math.min(Math.max(timeSec, 0), this.durationSec) : Math.max(timeSec, 0)
  }

  private getOrCreateAudioContext() {
    this.audioContext ??= new AudioContext()
    return this.audioContext
  }

  private emit() {
    for (const listener of this.listeners) {
      listener()
    }
  }
}
