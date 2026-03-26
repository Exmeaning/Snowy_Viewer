import {
  fillRect,
  stageConstants,
  stageHeightRatio,
  stageTopRatio,
  stageWidthRatio,
  worldBackgroundHeight,
  worldBackgroundLeft,
  worldBackgroundTop,
  worldBackgroundWidth,
  worldStageHeight,
  worldStageLeft,
  worldStageTop,
  worldStageWidth,
} from './constants'
import { mmwAtlases, mmwTextureUrls } from './mmwAssets'
import type { PreviewRuntimeConfig } from './types'

type TextureKey = 'background' | 'stage' | 'notes' | 'longNoteLine' | 'touchLine' | 'effect'

type LoadedTexture = {
  image: HTMLImageElement
  texture: WebGLTexture
}

const FLOATS_PER_VERTEX = 9
const FLOATS_PER_QUAD = 25

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to create shader.')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader error.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `#version 300 es
    precision mediump float;
    layout (location = 0) in vec2 aPos;
    layout (location = 1) in vec2 aUv;
    layout (location = 2) in vec4 aColor;
    layout (location = 3) in float aReciprocalW;
    out vec2 vUv;
    out vec4 vColor;
    void main() {
      vUv = aUv;
      vColor = aColor;
      float w = aReciprocalW != 0.0 ? (1.0 / aReciprocalW) : 1.0;
      gl_Position = vec4(aPos * w, 0.0, w);
    }`,
  )
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float;
    in vec2 vUv;
    in vec4 vColor;
    uniform sampler2D uTexture;
    out vec4 outColor;
    void main() {
      outColor = texture(uTexture, vUv) * vColor;
    }`,
  )

  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create WebGL program.')
  }
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error.'
    gl.deleteProgram(program)
    throw new Error(message)
  }

  return program
}

function createEffectProgram(gl: WebGL2RenderingContext) {
  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `#version 300 es
    precision mediump float;
    layout (location = 0) in vec2 aPos;
    layout (location = 1) in vec2 aUv;
    layout (location = 2) in vec4 aColor;
    layout (location = 3) in float aReciprocalW;
    out vec2 vUv;
    out vec4 vColor;
    void main() {
      vUv = aUv;
      vColor = aColor;
      float w = aReciprocalW != 0.0 ? (1.0 / aReciprocalW) : 1.0;
      gl_Position = vec4(aPos * w, 0.0, w);
    }`,
  )
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision mediump float;
    in vec2 vUv;
    in vec4 vColor;
    uniform sampler2D uTexture;
    out vec4 outColor;
    void main() {
      vec4 texColor = texture(uTexture, vUv) * vColor;
      float alpha = texColor.a;
      outColor = vec4(texColor.rgb * texColor.aaa, alpha);
    }`,
  )

  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create WebGL effect program.')
  }
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown effect program link error.'
    gl.deleteProgram(program)
    throw new Error(message)
  }

  return program
}

async function loadImage(url: string) {
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return image
}

export class GlPreviewRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly effectProgram: WebGLProgram
  private readonly buffer: WebGLBuffer
  private readonly vao: WebGLVertexArrayObject
  private readonly textures = new Map<TextureKey, LoadedTexture>()

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true })
    if (!gl) {
      throw new Error('WebGL2 is required for this preview.')
    }

    this.gl = gl
    this.program = createProgram(gl)
    this.effectProgram = createEffectProgram(gl)

    const buffer = gl.createBuffer()
    const vao = gl.createVertexArray()
    if (!buffer || !vao) {
      throw new Error('Failed to allocate WebGL buffers.')
    }

    this.buffer = buffer
    this.vao = vao

    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, FLOATS_PER_VERTEX * 4, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, FLOATS_PER_VERTEX * 4, 2 * 4)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, FLOATS_PER_VERTEX * 4, 4 * 4)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, FLOATS_PER_VERTEX * 4, 8 * 4)
    gl.bindVertexArray(null)

    gl.useProgram(this.program)
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0)
    gl.useProgram(this.effectProgram)
    gl.uniform1i(gl.getUniformLocation(this.effectProgram, 'uTexture'), 0)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  async loadTextures() {
    await Promise.all(
      (Object.entries(mmwTextureUrls) as [TextureKey, string][]).map(async ([key, url]) => {
        const image = await loadImage(url)
        const texture = this.gl.createTexture()
        if (!texture) {
          throw new Error(`Failed to create texture for ${key}.`)
        }

        this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 0)
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.RGBA,
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          image,
        )
        this.textures.set(key, { image, texture })
      }),
    )
  }

  resize(width: number, height: number, dpr: number) {
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  /** Render background + stage only (no notes). Safe to call before textures are loaded. */
  renderEmpty(config: PreviewRuntimeConfig) {
    const gl = this.gl
    gl.clearColor(0.03, 0.03, 0.05, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (this.textures.size > 0) {
      try { this.drawStaticScene(config) } catch { /* textures partially loaded */ }
    }
  }

  render(frame: Float32Array, quadCount: number, config: PreviewRuntimeConfig) {
    const gl = this.gl
    gl.clearColor(0.03, 0.03, 0.05, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    this.drawStaticScene(config)
    this.drawFrame(frame, quadCount, config)
  }

  private drawStaticScene(config: PreviewRuntimeConfig) {
    this.drawQuadBatch(
      'background',
      this.buildTexturedQuad(
        'background',
        [
          { x: worldBackgroundLeft + worldBackgroundWidth, y: worldBackgroundTop },
          { x: worldBackgroundLeft + worldBackgroundWidth, y: worldBackgroundTop + worldBackgroundHeight },
          { x: worldBackgroundLeft, y: worldBackgroundTop + worldBackgroundHeight },
          { x: worldBackgroundLeft, y: worldBackgroundTop },
        ],
        {
          x1: 0,
          y1: 0,
          x2: this.requireTexture('background').image.width,
          y2: this.requireTexture('background').image.height,
        },
        [config.backgroundBrightness, config.backgroundBrightness, config.backgroundBrightness, 1],
      ),
    )

    this.drawQuadBatch(
      'stage',
      this.buildTexturedQuad(
        'stage',
        [
          { x: worldStageLeft + worldStageWidth, y: worldStageTop },
          { x: worldStageLeft + worldStageWidth, y: worldStageTop + worldStageHeight },
          { x: worldStageLeft, y: worldStageTop + worldStageHeight },
          { x: worldStageLeft, y: worldStageTop },
        ],
        mmwAtlases.stage[0],
        [1, 1, 1, config.stageOpacity],
      ),
    )
  }

  private drawFrame(frame: Float32Array, quadCount: number, config: PreviewRuntimeConfig) {
    let currentTexture: TextureKey | null = null
    let currentBlend: 'normal' | 'additive' = 'normal'
    let batch: number[] = []

    for (let index = 0; index < quadCount; index += 1) {
      const offset = index * FLOATS_PER_QUAD
      const textureId = Math.round(frame[offset + 24])
      const textureKey =
        textureId === 0
          ? 'notes'
          : textureId === 1
            ? 'longNoteLine'
            : textureId === 2
              ? 'touchLine'
              : 'effect'
      const blend = textureId === 4 ? 'additive' : 'normal'

      if ((currentTexture !== null && currentTexture !== textureKey) || (batch.length > 0 && blend !== currentBlend)) {
        this.drawQuadBatch(currentTexture ?? textureKey, batch, currentBlend)
        batch = []
      }

      currentTexture = textureKey
      currentBlend = blend
      this.appendRuntimeQuad(batch, textureKey, frame, offset, config)
    }

    if (currentTexture && batch.length > 0) {
      this.drawQuadBatch(currentTexture, batch, currentBlend)
    }
  }

  private appendRuntimeQuad(
    target: number[],
    textureKey: TextureKey,
    frame: Float32Array,
    offset: number,
    config: PreviewRuntimeConfig,
  ) {
    const texture = this.requireTexture(textureKey)
    const rawTextureId = Math.round(frame[offset + 24])
    const positions =
      [
        [frame[offset + 0], frame[offset + 1], frame[offset + 2]],
        [frame[offset + 3], frame[offset + 4], frame[offset + 5]],
        [frame[offset + 6], frame[offset + 7], frame[offset + 8]],
        [frame[offset + 9], frame[offset + 10], frame[offset + 11]],
      ] as const
    const clipPositions: readonly [
      readonly [number, number, number],
      readonly [number, number, number],
      readonly [number, number, number],
      readonly [number, number, number],
    ] =
      rawTextureId >= 3
        ? [
            [positions[0][0], positions[0][1], positions[0][2]],
            [positions[1][0], positions[1][1], positions[1][2]],
            [positions[2][0], positions[2][1], positions[2][2]],
            [positions[3][0], positions[3][1], positions[3][2]],
          ]
        : [
            [...this.worldToClip(positions[0][0], positions[0][1]), 1] as const,
            [...this.worldToClip(positions[1][0], positions[1][1]), 1] as const,
            [...this.worldToClip(positions[2][0], positions[2][1]), 1] as const,
            [...this.worldToClip(positions[3][0], positions[3][1]), 1] as const,
          ]

    const uvs = [
      [frame[offset + 12] / texture.image.width, frame[offset + 13] / texture.image.height],
      [frame[offset + 14] / texture.image.width, frame[offset + 15] / texture.image.height],
      [frame[offset + 16] / texture.image.width, frame[offset + 17] / texture.image.height],
      [frame[offset + 18] / texture.image.width, frame[offset + 19] / texture.image.height],
    ] as const

    const alphaMultiplier = textureKey === 'effect' ? config.effectOpacity : 1
    const color = [
      frame[offset + 20],
      frame[offset + 21],
      frame[offset + 22],
      frame[offset + 23] * alphaMultiplier,
    ] as const

    this.pushTriangle(target, [clipPositions[0][0], clipPositions[0][1]], uvs[0], color, clipPositions[0][2])
    this.pushTriangle(target, [clipPositions[1][0], clipPositions[1][1]], uvs[1], color, clipPositions[1][2])
    this.pushTriangle(target, [clipPositions[2][0], clipPositions[2][1]], uvs[2], color, clipPositions[2][2])
    this.pushTriangle(target, [clipPositions[0][0], clipPositions[0][1]], uvs[0], color, clipPositions[0][2])
    this.pushTriangle(target, [clipPositions[2][0], clipPositions[2][1]], uvs[2], color, clipPositions[2][2])
    this.pushTriangle(target, [clipPositions[3][0], clipPositions[3][1]], uvs[3], color, clipPositions[3][2])
  }

  private buildTexturedQuad(
    textureKey: TextureKey,
    points: Array<{ x: number; y: number }>,
    sprite: { x1: number; y1: number; x2: number; y2: number },
    color: [number, number, number, number],
  ) {
    const texture = this.requireTexture(textureKey)
    const clip = points.map(({ x, y }) => this.worldToClip(x, y))
    const uvs = [
      [sprite.x2 / texture.image.width, sprite.y1 / texture.image.height],
      [sprite.x2 / texture.image.width, sprite.y2 / texture.image.height],
      [sprite.x1 / texture.image.width, sprite.y2 / texture.image.height],
      [sprite.x1 / texture.image.width, sprite.y1 / texture.image.height],
    ] as const

    const vertices: number[] = []
    this.pushTriangle(vertices, clip[0], uvs[0], color, 1)
    this.pushTriangle(vertices, clip[1], uvs[1], color, 1)
    this.pushTriangle(vertices, clip[2], uvs[2], color, 1)
    this.pushTriangle(vertices, clip[0], uvs[0], color, 1)
    this.pushTriangle(vertices, clip[2], uvs[2], color, 1)
    this.pushTriangle(vertices, clip[3], uvs[3], color, 1)
    return vertices
  }

  private drawQuadBatch(textureKey: TextureKey, vertices: number[], blend: 'normal' | 'additive' = 'normal') {
    const gl = this.gl
    if (vertices.length === 0) {
      return
    }

    const program = textureKey === 'effect' ? this.effectProgram : this.program
    gl.useProgram(program)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.requireTexture(textureKey).texture)
    if (textureKey === 'effect') {
      if (blend === 'additive') {
        gl.blendFunc(gl.ONE, gl.ONE)
      } else {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      }
    } else if (blend === 'additive') {
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE)
    } else {
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / FLOATS_PER_VERTEX)
    gl.bindVertexArray(null)
  }

  private pushTriangle(
    target: number[],
    position: readonly [number, number],
    uv: readonly [number, number],
    color: readonly [number, number, number, number],
    reciprocalW: number,
  ) {
    target.push(position[0], position[1], uv[0], uv[1], color[0], color[1], color[2], color[3], reciprocalW)
  }

  private worldToClip(worldX: number, worldY: number): [number, number] {
    const { width, height } = fillRect(
      stageConstants.stageTargetWidth,
      stageConstants.stageTargetHeight,
      this.canvas.width / this.canvas.height,
    )

    const scaledWidth = stageConstants.stageTargetWidth * stageWidthRatio
    const scaledHeight = stageConstants.stageTargetHeight * stageHeightRatio
    const screenTop = stageConstants.stageTargetHeight * stageTopRatio
    const x = (2 * worldX * scaledWidth) / width
    const y = (-2 * (worldY * scaledHeight - screenTop)) / height
    return [x, y]
  }

  private requireTexture(key: TextureKey) {
    const texture = this.textures.get(key)
    if (!texture) {
      throw new Error(`Texture ${key} has not been loaded.`)
    }
    return texture
  }

  async setBackgroundUrl(url: string) {
    const image = await loadImage(url)
    const existing = this.textures.get('background')
    if (existing) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, existing.texture)
      this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 0)
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        image,
      )
      existing.image = image
    }
  }
}
