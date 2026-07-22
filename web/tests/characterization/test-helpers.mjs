import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = path.resolve(TEST_DIR, "../..");

export function readWeb(relativePath) {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), "utf8");
}

export function readJson(relativePath) {
  return JSON.parse(readWeb(relativePath));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const baseline = deepFreeze(readJson("tests/fixtures/localization-baseline.json"));

let moduleSequence = 0;

export async function importTypeScriptSource(source, label = "characterization") {
  moduleSequence += 1;
  const javascript = stripTypeScriptTypes(source, { mode: "transform", sourceMap: false });
  const encoded = Buffer.from(`${javascript}\n//# sourceURL=${label}-${moduleSequence}.mjs`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

export async function importWebTypeScript(relativePath, substitutions = []) {
  let source = readWeb(relativePath);
  for (const [from, to] of substitutions) {
    if (!source.includes(from)) {
      throw new Error(`Unable to apply characterization substitution in ${relativePath}: ${from}`);
    }
    source = source.replace(from, to);
  }
  return importTypeScriptSource(source, relativePath.replaceAll("/", "-"));
}

export function createStorage(initial = {}) {
  const entries = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
    snapshot() {
      return Object.fromEntries(entries);
    },
  };
}

export function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}
