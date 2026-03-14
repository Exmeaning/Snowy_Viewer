type TriggerOptions = {
  x: number
  width: number
  timeSec: number
  untilSec?: number
}

export class MmwEffectSystem {
  private readonly ctx: CanvasRenderingContext2D

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('2D canvas is required for effect rendering.')
    }
    this.ctx = ctx
  }

  async load() {}

  resize(width: number, height: number, dpr: number) {
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
  }

  trigger(_effectName: string, _trigger: TriggerOptions) {}

  render(_nowSec: number) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  reset() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}
