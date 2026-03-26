import { fillRect, stageConstants, stageHeightRatio, stageTopRatio, stageWidthRatio } from './constants'
import type { HitEvent } from './types'

type EffectParticle = {
  startedAtSec: number
  lifetimeSec: number
  x: number
  y: number
  radius: number
  kind: 'ring' | 'spark'
  vx: number
  vy: number
  color: string
  alpha: number
}

export class JudgementEffects {
  private readonly ctx: CanvasRenderingContext2D
  private readonly particles: EffectParticle[] = []

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2D canvas is required for judgement effects.')
    }
    this.ctx = ctx
  }

  resize(width: number, height: number, dpr: number) {
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
  }

  trigger(event: HitEvent, nowSec: number) {
    const center = this.worldToScreen(event.center, 1)
    const spread = Math.max(12, event.width * this.canvas.width * 0.018)
    const color = event.critical ? '157, 255, 236' : event.kind === 'flick' ? '255, 196, 112' : '168, 213, 255'

    this.particles.push({
      startedAtSec: nowSec,
      lifetimeSec: event.kind === 'holdLoop' ? 0.36 : 0.28,
      x: center.x,
      y: center.y,
      radius: spread,
      kind: 'ring',
      vx: 0,
      vy: -20,
      color,
      alpha: event.critical ? 0.75 : 0.58,
    })

    const sparkCount = event.kind === 'holdLoop' ? 10 : 14
    for (let index = 0; index < sparkCount; index += 1) {
      const angle = (Math.PI * 2 * index) / sparkCount + (event.kind === 'flick' ? -0.35 : 0)
      const speed = spread * (event.kind === 'flick' ? 2.3 : 1.6)
      this.particles.push({
        startedAtSec: nowSec,
        lifetimeSec: event.kind === 'holdLoop' ? 0.28 : 0.24,
        x: center.x,
        y: center.y,
        radius: event.critical ? 4 : 3,
        kind: 'spark',
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        color,
        alpha: event.critical ? 0.8 : 0.62,
      })
    }
  }

  render(nowSec: number) {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    const survivors: EffectParticle[] = []
    for (const particle of this.particles) {
      const progress = (nowSec - particle.startedAtSec) / particle.lifetimeSec
      if (progress < 0 || progress >= 1) {
        continue
      }

      survivors.push(particle)
      const fade = 1 - progress
      const x = particle.x + particle.vx * progress
      const y = particle.y + particle.vy * progress + 24 * progress * progress
      ctx.strokeStyle = `rgba(${particle.color}, ${particle.alpha * fade})`
      ctx.fillStyle = `rgba(${particle.color}, ${particle.alpha * fade})`

      if (particle.kind === 'ring') {
        ctx.lineWidth = Math.max(2, this.canvas.width * 0.0016)
        ctx.beginPath()
        ctx.ellipse(x, y, particle.radius * (0.55 + progress * 0.85), particle.radius * (0.16 + progress * 0.18), 0, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.lineWidth = Math.max(1.5, this.canvas.width * 0.0011)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - particle.vx * 0.018 * fade, y - particle.vy * 0.018 * fade)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, particle.radius * (1.2 + progress * 1.8) * 0.32, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    this.particles.length = 0
    this.particles.push(...survivors)
    ctx.restore()
  }

  reset() {
    this.particles.length = 0
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private worldToScreen(worldX: number, _worldY: number) {
    const { width, height } = fillRect(
      stageConstants.stageTargetWidth,
      stageConstants.stageTargetHeight,
      this.canvas.width / this.canvas.height,
    )

    const scaledWidth = stageConstants.stageTargetWidth * stageWidthRatio
    const scaledHeight = stageConstants.stageTargetHeight * stageHeightRatio
    const screenTop = stageConstants.stageTargetHeight * stageTopRatio
    const clipX = (2 * worldX * scaledWidth) / width
    const clipY = (-2 * (_worldY * scaledHeight - screenTop)) / height

    return {
      x: ((clipX + 1) * this.canvas.width) / 2,
      y: ((1 - clipY) * this.canvas.height) / 2,
    }
  }
}
