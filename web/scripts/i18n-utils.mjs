import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const WEB_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export const SRC_ROOT = path.join(WEB_ROOT, "src");
export const MESSAGE_FILES = {
    "zh-CN": path.join(SRC_ROOT, "lib/i18n/messages/zh-CN/index.ts"),
    "en-US": path.join(SRC_ROOT, "lib/i18n/messages/en-US/index.ts"),
    "ja-JP": path.join(SRC_ROOT, "lib/i18n/messages/ja-JP/index.ts"),
    "ko-KR": path.join(SRC_ROOT, "lib/i18n/messages/ko-KR/index.ts"),
};

export const MESSAGE_EXPORTS = {
    "zh-CN": "zhCNMessages",
    "en-US": "enUSMessages",
    "ja-JP": "jaJPMessages",
    "ko-KR": "koKRMessages",
};

export const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export function toPosixPath(filePath) {
    return filePath.split(path.sep).join("/");
}

export function walkSourceFiles(root = SRC_ROOT) {
    const results = [];
    const stack = [root];

    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }

            if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
                results.push(fullPath);
            }
        }
    }

    return results.sort();
}

export function flattenMessageKeys(value, prefix = "") {
    if (typeof value === "string") {
        return [prefix];
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return [];
    }

    return Object.entries(value).flatMap(([key, child]) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        return flattenMessageKeys(child, nextPrefix);
    });
}

function stripTypeOnlySyntax(source) {
    return source
        .replace(/import\s+type\s+[^;]+;\s*/g, "")
        .replace(/\s+as\s+const\s+satisfies\s+MessageTree\s*;?\s*$/m, ";")
        .replace(/\s+satisfies\s+MessageTree/g, "");
}

export function loadMessageObject(filePath, exportName) {
    const raw = fs.readFileSync(filePath, "utf8");
    const executable = stripTypeOnlySyntax(raw)
        .replace(new RegExp(`export\\s+const\\s+${exportName}\\s*=`), `globalThis.__messages =`);

    const context = vm.createContext({ globalThis: {} });
    vm.runInContext(executable, context, { filename: filePath });
    return context.globalThis.__messages;
}

export function loadAllMessages() {
    return Object.fromEntries(
        Object.entries(MESSAGE_FILES).map(([locale, filePath]) => [
            locale,
            loadMessageObject(filePath, MESSAGE_EXPORTS[locale]),
        ])
    );
}

export function formatLine(filePath, lineNumber, message) {
    return `${toPosixPath(path.relative(WEB_ROOT, filePath))}:${lineNumber}: ${message}`;
}
