/* tslint:disable */
/* eslint-disable */

export class BackgroundPatternRenderer {
    free(): void;
    [Symbol.dispose](): void;
    constructor(canvas: HTMLCanvasElement, source_image: HTMLImageElement, theme_color: string);
    render(timestamp_ms: number): void;
    resize(width: number, height: number, device_pixel_ratio: number): void;
    set_theme_color(theme_color: string): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_backgroundpatternrenderer_free: (a: number, b: number) => void;
    readonly backgroundpatternrenderer_new: (a: any, b: any, c: number, d: number) => [number, number, number];
    readonly backgroundpatternrenderer_render: (a: number, b: number) => [number, number];
    readonly backgroundpatternrenderer_resize: (a: number, b: number, c: number, d: number) => [number, number];
    readonly backgroundpatternrenderer_set_theme_color: (a: number, b: number, c: number) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
