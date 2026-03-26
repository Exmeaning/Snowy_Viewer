import type { HitEvent, HitEventKind, HudEvent, HudEventKind, LoadedQuadFrame, PreviewRuntimeConfig, SongMetadata } from './types'

const FLOATS_PER_QUAD = 25

type EmscriptenModule = {
  HEAPF32: Float32Array
  HEAPU8: Uint8Array
  ccall: (
    ident: string,
    returnType: string | null,
    argTypes: string[],
    args: unknown[],
  ) => unknown
  _malloc: (size: number) => number
  _free: (ptr: number) => void
}

let modulePromise: Promise<EmscriptenModule> | null = null

async function loadModule() {
  if (!modulePromise) {
    modulePromise = (async () => {
      // The WASM JS glue is an ES module (`export default factory`).
      // We use Function() to create a dynamic import() that bypasses webpack/Next.js bundling,
      // so the browser loads the file directly from /wasm/ at runtime.
      // Cache-bust hash — update when wasm/js files are replaced
      const WASM_VERSION = '25f_recipw'
      const jsUrl = `/wasm/mmw-preview.js?v=${WASM_VERSION}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await (Function('url', 'return import(url)')(jsUrl) as Promise<any>)
      const factory = mod.default as (options: { locateFile: (file: string) => string }) => Promise<EmscriptenModule>
      return factory({
        locateFile: (file: string) => `/wasm/${file}?v=${WASM_VERSION}`,
      })
    })()
  }
  return modulePromise
}

export class MmwWasmPreview {
  private module: EmscriptenModule | null = null

  async init() {
    if (this.module) {
      return
    }
    this.module = await loadModule()
    this.module.ccall('init', 'number', ['number'], [0])
  }

  resize(width: number, height: number, dpr: number) {
    this.assertReady().ccall('resize', null, ['number', 'number', 'number'], [width, height, dpr])
  }

  loadSusText(susText: string, normalizedOffsetMs: number) {
    const module = this.assertReady()
    const encoded = new TextEncoder().encode(susText)
    const ptr = module._malloc(encoded.length + 1)
    let ok = 0
    try {
      module.HEAPU8.set(encoded, ptr)
      module.HEAPU8[ptr + encoded.length] = 0
      ok = Number(
        module.ccall(
          'loadSusText',
          'number',
          ['number', 'number'],
          [ptr, Math.round(normalizedOffsetMs)],
        ),
      )
    } finally {
      module._free(ptr)
    }
    if (ok !== 1) {
      throw new Error(this.getLastError() || 'Failed to parse SUS.')
    }
  }

  setPreviewConfig(config: PreviewRuntimeConfig) {
    this.assertReady().ccall(
      'setPreviewConfig',
      null,
      ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [
        config.mirror ? 1 : 0,
        config.flickAnimation ? 1 : 0,
        config.holdAnimation ? 1 : 0,
        config.simultaneousLine ? 1 : 0,
        config.noteSpeed,
        config.holdAlpha,
        config.guideAlpha,
        config.stageOpacity,
        config.backgroundBrightness,
      ],
    )
  }

  render(chartTimeSec: number): LoadedQuadFrame {
    const module = this.assertReady()
    const count = Number(module.ccall('render', 'number', ['number'], [chartTimeSec]))
    const pointer = Number(module.ccall('getQuadBufferPointer', 'number', [], []))

    if (!count || !pointer) {
      return { count: 0, floats: new Float32Array() }
    }

    return {
      count,
      floats: module.HEAPF32.subarray(pointer / 4, pointer / 4 + count * FLOATS_PER_QUAD),
    }
  }

  getChartEndTimeSec() {
    return Number(this.assertReady().ccall('getChartEndTimeSec', 'number', [], []))
  }

  getHitEvents(): HitEvent[] {
    const module = this.assertReady()
    const count = Number(module.ccall('getHitEventCount', 'number', [], []))
    const pointer = Number(module.ccall('getHitEventBufferPointer', 'number', [], []))

    if (!count || !pointer) {
      return []
    }

    const stride = 6
    const packed = module.HEAPF32.subarray(pointer / 4, pointer / 4 + count * stride)
    const events: HitEvent[] = []
    for (let index = 0; index < count; index += 1) {
      const offset = index * stride
      const kindValue = Math.round(packed[offset + 3])
      const kind: HitEventKind =
        kindValue === 1
          ? 'criticalTap'
          : kindValue === 2
            ? 'flick'
            : kindValue === 3
              ? 'trace'
              : kindValue === 4
                ? 'tick'
                : kindValue === 5
                  ? 'holdLoop'
                  : 'tap'
      const flags = Math.round(packed[offset + 4])

      events.push({
        timeSec: packed[offset + 0],
        center: packed[offset + 1],
        width: packed[offset + 2],
        kind,
        critical: (flags & 1) !== 0,
        endTimeSec: packed[offset + 5] >= 0 ? packed[offset + 5] : undefined,
      })
    }

    return events
  }

  getSongMetadata(): SongMetadata {
    const module = this.assertReady()
    return {
      title: String(module.ccall('getMetadataTitle', 'string', [], [])),
      artist: String(module.ccall('getMetadataArtist', 'string', [], [])),
      designer: String(module.ccall('getMetadataDesigner', 'string', [], [])),
    }
  }

  getHudEvents(): HudEvent[] {
    const module = this.assertReady()
    const count = Number(module.ccall('getHudEventCount', 'number', [], []))
    const pointer = Number(module.ccall('getHudEventBufferPointer', 'number', [], []))

    if (!count || !pointer) {
      return []
    }

    const stride = 4
    const packed = module.HEAPF32.subarray(pointer / 4, pointer / 4 + count * stride)
    const events: HudEvent[] = []
    for (let index = 0; index < count; index += 1) {
      const offset = index * stride
      const kindValue = Math.round(packed[offset + 2])
      const kind: HudEventKind =
        kindValue === 1
          ? 'criticalTap'
          : kindValue === 2
            ? 'flick'
            : kindValue === 3
              ? 'trace'
              : kindValue === 4
                ? 'tick'
                : kindValue === 5
                  ? 'holdHalfBeat'
                  : 'tap'
      const flags = Math.round(packed[offset + 3])

      events.push({
        timeSec: packed[offset + 0],
        weight: packed[offset + 1],
        kind,
        critical: (flags & 1) !== 0,
        halfBeat: (flags & 2) !== 0,
        showJudge: (flags & 4) !== 0,
      })
    }
    return events
  }

  getLastError() {
    return String(this.assertReady().ccall('getLastError', 'string', [], []))
  }

  dispose() {
    if (!this.module) {
      return
    }
    this.module.ccall('dispose', null, [], [])
  }

  private assertReady() {
    if (!this.module) {
      throw new Error('Wasm module has not been initialized.')
    }
    return this.module
  }
}
