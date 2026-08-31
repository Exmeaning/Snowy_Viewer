/**
 * WASM Deck Recommend Artifact Copier
 *
 * 把 npm 包 haruki-sekai-deck-recommend-cpp 的产物拷贝到 public/wasm/，
 * 让浏览器在运行时直接从 /wasm/ 加载，而不经过 Turbopack 打包。
 *
 * 之所以不直接 import 该包：其 emscripten glue（sekai_deck_recommend.js，96KB）
 * 依赖 import.meta.url 与 ENVIRONMENT_IS_NODE 分支，交给打包器处理容易出问题。
 * 这与 public/wasm/mmw-preview.js 的既有做法一致。
 *
 * 同时生成 src/lib/deck-engine/wasm-version.ts，供加载器做缓存击穿。
 *
 * 使用方法: node scripts/copy-wasm-artifacts.mjs
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

const PACKAGE_NAME = 'haruki-sekai-deck-recommend-cpp';

/** 需要拷贝到 public/wasm/ 的文件（源文件名 → 目标文件名）。
 *  index.js 改名以免和 public/wasm/ 下别的产物撞名；它内部对
 *  ./sekai_deck_recommend.js 的相对导入不受改名影响，同目录下浏览器原生解析。 */
const ARTIFACTS = [
    ['index.js', 'sekai-deck-recommend.js'],
    ['sekai_deck_recommend.js', 'sekai_deck_recommend.js'],
    ['sekai_deck_recommend.wasm', 'sekai_deck_recommend.wasm'],
];

const OUT_DIR = path.join(webRoot, 'public', 'wasm');
const VERSION_FILE = path.join(webRoot, 'src', 'lib', 'deck-engine', 'wasm-version.ts');

function resolvePackageDir() {
    // workspaces 会把依赖提升到仓库根 node_modules，所以用 require.resolve 而不是拼路径。
    // 该包的 exports 没有暴露 ./package.json，所以走一个确实导出的子路径再取目录。
    const require = createRequire(import.meta.url);
    const entry = require.resolve(`${PACKAGE_NAME}/sekai_deck_recommend.js`, {
        paths: [webRoot, path.resolve(webRoot, '..')],
    });
    return path.dirname(entry);
}

function main() {
    let packageDir;
    try {
        packageDir = resolvePackageDir();
    } catch {
        console.error(
            `[copy-wasm] 找不到 ${PACKAGE_NAME}。先跑 npm install。`,
        );
        process.exit(1);
    }

    const pkg = JSON.parse(
        fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
    );

    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const [srcName, outName] of ARTIFACTS) {
        const src = path.join(packageDir, srcName);
        if (!fs.existsSync(src)) {
            console.error(`[copy-wasm] 缺少产物: ${src}`);
            process.exit(1);
        }
        fs.copyFileSync(src, path.join(OUT_DIR, outName));
    }

    // 版本号既做缓存击穿，也让加载器在产物与依赖不同步时能被发现。
    fs.mkdirSync(path.dirname(VERSION_FILE), { recursive: true });
    fs.writeFileSync(
        VERSION_FILE,
        `// 由 scripts/copy-wasm-artifacts.mjs 生成，请勿手改。\n` +
            `export const DECK_ENGINE_WASM_VERSION = ${JSON.stringify(pkg.version)};\n`,
        'utf8',
    );

    console.log(
        `[copy-wasm] ${PACKAGE_NAME}@${pkg.version} → public/wasm/ (${ARTIFACTS.map(([, out]) => out).join(', ')})`,
    );
}

main();
