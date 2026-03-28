export type BackgroundPatternRendererInstance = {
  resize: (width: number, height: number, devicePixelRatio: number) => void
  render: (timestampMs: number) => void
  set_theme_color: (themeColor: string) => void
  free: () => void
}

type BackgroundPatternWasmModule = {
  default: (
    input?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module,
  ) => Promise<unknown>
  BackgroundPatternRenderer: new (
    canvas: HTMLCanvasElement,
    sourceImage: HTMLImageElement,
    themeColor: string,
  ) => BackgroundPatternRendererInstance
}

const WASM_VERSION = '20260308-rust-bg-v6'
let modulePromise: Promise<BackgroundPatternWasmModule> | null = null

export async function loadBackgroundPatternWasm() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const jsUrl = `/wasm/background-pattern/background_pattern_wasm.js?v=${WASM_VERSION}`
      const wasmUrl = `/wasm/background-pattern/background_pattern_wasm_bg.wasm?v=${WASM_VERSION}`
      const mod = await (Function('url', 'return import(url)')(jsUrl) as Promise<BackgroundPatternWasmModule>)
      await mod.default(wasmUrl)
      return mod
    })()
  }

  return modulePromise
}
