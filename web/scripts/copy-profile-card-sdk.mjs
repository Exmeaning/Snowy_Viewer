// Copies @empty-sekai/sekai-custom-profile-sdk dist artifacts (worker + wasm + ESM
// modules) into public/ so the renderer worker can be loaded outside the bundler,
// same approach as public/wasm for the chart previewer.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "public", "profile-card-sdk");

const candidates = [
    join(here, "..", "node_modules", "@empty-sekai", "sekai-custom-profile-sdk", "dist"),
    join(here, "..", "..", "node_modules", "@empty-sekai", "sekai-custom-profile-sdk", "dist"),
];
const dist = candidates.find((path) => existsSync(path));

if (!dist) {
    console.error(`[copy-profile-card-sdk] SDK dist not found in node_modules`);
    process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(dist, target, { recursive: true, filter: (src) => !src.endsWith(".d.ts") });
console.log(`[copy-profile-card-sdk] copied ${dist} -> ${target}`);
