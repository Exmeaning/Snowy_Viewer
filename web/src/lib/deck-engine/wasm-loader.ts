/**
 * 组卡 wasm 引擎加载器。
 *
 * 引擎是 haruki-sekai-deck-recommend-cpp（Team-Haruki/sekai-deck-recommend-cpp
 * 的 WebAssembly 构建，源头是 NeuraXmy 的 C++ 版 sekai-calculator）。
 *
 * 产物由 scripts/copy-wasm-artifacts.mjs 拷到 public/wasm/，运行时用动态
 * import 直接从 /wasm/ 加载，**不经过打包器**——emscripten glue 依赖
 * import.meta.url 和 ENVIRONMENT_IS_NODE 分支，交给 Turbopack 处理容易出问题。
 * 这与 lib/chart-preview/mmwWasm.ts 的既有做法一致。
 *
 * 只在 Web Worker 里用（见 engine-worker.ts）：master data 动辄几十 MB，
 * 搜索本身也是 CPU 密集的，不能占主线程。
 */

import type {
    RawSekaiDeckRecommendModule,
    SekaiDeckRecommendWasm,
} from "haruki-sekai-deck-recommend-cpp";

import { DECK_ENGINE_WASM_VERSION } from "./wasm-version";

/** 引擎对没提供的可选 master 表会逐条打 warning。这些表我们确实不下发
 *  （体积大且组卡用不上），warning 是预期内的，过滤掉以免刷屏。 */
const EXPECTED_MISSING_MASTER_KEYS = [
    "eventCardBonusLimits",
    "eventHonorBonuses",
    "eventMysekaiFixtureGameCharacterPerformanceBonusLimits",
    "eventSkillScoreUpLimits",
    "ingameCombos",
    "ingameNotes",
    "mysekaiFixtureGameCharacterGroupPerformanceBonuses",
    "mysekaiFixtureGameCharacterGroups",
];

function isExpectedMissingKeyWarning(text: string): boolean {
    if (!text.includes("master data key not found")) return false;
    return EXPECTED_MISSING_MASTER_KEYS.some((key) => text.includes(key));
}

type EngineFactory = (options: {
    wasmUrl?: string;
    staticDataPath?: string;
    moduleOptions?: {
        print?: (text: string) => void;
        printErr?: (text: string) => void;
    };
}) => Promise<SekaiDeckRecommendWasm>;

let enginePromise: Promise<SekaiDeckRecommendWasm> | null = null;

/**
 * 加载并初始化引擎。同一个 worker 内是单例——wasm 实例可以跨多次
 * recommend 复用，master data 与用户数据快照也挂在上面。
 */
export function loadDeckEngine(): Promise<SekaiDeckRecommendWasm> {
    if (!enginePromise) {
        enginePromise = (async () => {
            const v = encodeURIComponent(DECK_ENGINE_WASM_VERSION);
            const loaderUrl = `/wasm/sekai-deck-recommend.js?v=${v}`;

            // 用 Function() 构造动态 import，绕开打包器的静态分析，
            // 让浏览器在运行时直接拉 /wasm/ 下的文件。
            const mod = (await Function(
                "url",
                "return import(url)",
            )(loaderUrl)) as {
                createSekaiDeckRecommend: EngineFactory;
                default?: EngineFactory;
            };

            const factory = mod.createSekaiDeckRecommend ?? mod.default;
            if (typeof factory !== "function") {
                throw new Error(
                    "deck engine loader did not export createSekaiDeckRecommend",
                );
            }

            return factory({
                wasmUrl: `/wasm/sekai_deck_recommend.wasm?v=${v}`,
                // "/data" 是 emscripten 虚拟文件系统里的路径，不是我们的 public/data。
                // worldBloomSupportDeckBonusesWL{1,2,3}.json 在构建期就用
                // --embed-file 嵌进 wasm 了，引擎从这里读。
                // 千万别改成真实 URL 路径——那样 loadMasterData 会直接抛
                // "master data key not found: worldBloomSupportDeckBonusesWL1"。
                staticDataPath: "/data",
                moduleOptions: {
                    printErr: (text: string) => {
                        if (isExpectedMissingKeyWarning(text)) return;
                        console.warn("[deck-engine]", text);
                    },
                },
            });
        })().catch((err) => {
            // 失败不缓存，下次调用可以重试（比如首次加载时网络抖了一下）。
            enginePromise = null;
            throw err;
        });
    }
    return enginePromise;
}

/**
 * 预加载 / 预热 WASM 产物。
 * 在用户进入组卡推荐或控分页面时触发，提前下载 .js 和 .wasm 到浏览器缓存，
 * 避免用户点击计算时还要等待网络拉取 wasm 产物。
 */
export function preloadDeckEngine(): void {
    if (typeof window === "undefined" && typeof self === "undefined") return;
    const v = encodeURIComponent(DECK_ENGINE_WASM_VERSION);
    const jsUrl = `/wasm/sekai-deck-recommend.js?v=${v}`;
    const wasmUrl = `/wasm/sekai_deck_recommend.wasm?v=${v}`;

    try {
        if (typeof fetch === "function") {
            fetch(jsUrl, { cache: "force-cache" }).catch(() => {});
            fetch(wasmUrl, { cache: "force-cache" }).catch(() => {});
        }
    } catch {
        // ignore prefetch errors
    }
}

export type { RawSekaiDeckRecommendModule, SekaiDeckRecommendWasm };

