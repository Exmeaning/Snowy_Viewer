import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const WEB_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export const SRC_ROOT = path.join(WEB_ROOT, "src");
export const MESSAGE_FILES = {
    "zh-CN": path.join(SRC_ROOT, "lib/i18n/messages/zh-CN/index.ts"),
    "zh-TW": path.join(SRC_ROOT, "lib/i18n/messages/zh-TW/index.ts"),
    "en-US": path.join(SRC_ROOT, "lib/i18n/messages/en-US/index.ts"),
    "ja-JP": path.join(SRC_ROOT, "lib/i18n/messages/ja-JP/index.ts"),
    "ko-KR": path.join(SRC_ROOT, "lib/i18n/messages/ko-KR/index.ts"),
};

export const MESSAGE_EXPORTS = {
    "zh-CN": "zhCNMessages",
    "zh-TW": "zhTWMessages",
    "en-US": "enUSMessages",
    "ja-JP": "jaJPMessages",
    "ko-KR": "koKRMessages",
};

export const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const ZH_TW_MESSAGE_MODULES = {
    common: ["common.ts", "zhTWCommon"],
    layout: ["shell.ts", "zhTWLayout"],
    search: ["shell.ts", "zhTWSearch"],
    settings: ["shell.ts", "zhTWSettings"],
    shortcuts: ["shell.ts", "zhTWShortcuts"],
    pagePrimary: ["page-primary.ts", "zhTWPagePrimary"],
    pageSecondaryA: ["page-secondary-a.ts", "zhTWPageSecondaryA"],
    pageSecondaryB: ["page-secondary-b.ts", "zhTWPageSecondaryB"],
};

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
        .replace(/\s+satisfies\s+MessageTree/g, "")
        .replace(/\s+as\s+const/g, "");
}

export function loadMessageObject(filePath, exportName) {
    const raw = fs.readFileSync(filePath, "utf8");
    const executable = stripTypeOnlySyntax(raw)
        .replace(/export\s+const\s+/g, "const ")
        .replace(new RegExp(`const\\s+${exportName}\\s*=`), `globalThis.__messages =`);

    const context = vm.createContext({ globalThis: {} });
    vm.runInContext(executable, context, { filename: filePath });
    return context.globalThis.__messages;
}

export function loadAllMessages() {
    return Object.fromEntries(
        Object.entries(MESSAGE_FILES).map(([locale, filePath]) => [
            locale,
            locale === "zh-TW"
                ? loadZhTWMessages()
                : loadMessageObject(filePath, MESSAGE_EXPORTS[locale]),
        ])
    );
}

function loadZhTWMessages() {
    const messageRoot = path.join(SRC_ROOT, "lib/i18n/messages/zh-TW");
    const loaded = Object.fromEntries(
        Object.entries(ZH_TW_MESSAGE_MODULES).map(([key, [fileName, exportName]]) => [
            key,
            loadMessageObject(path.join(messageRoot, fileName), exportName),
        ])
    );

    return {
        common: loaded.common,
        layout: loaded.layout,
        search: loaded.search,
        settings: loaded.settings,
        shortcuts: loaded.shortcuts,
        page: {
            ...loaded.pagePrimary,
            ...loaded.pageSecondaryA,
            ...loaded.pageSecondaryB,
        },
    };
}

export function formatLine(filePath, lineNumber, message) {
    return `${toPosixPath(path.relative(WEB_ROOT, filePath))}:${lineNumber}: ${message}`;
}
