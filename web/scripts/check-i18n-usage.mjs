#!/usr/bin/env node
import fs from "node:fs";
import { flattenMessageKeys, formatLine, loadAllMessages, SRC_ROOT, walkSourceFiles } from "./i18n-utils.mjs";

const messages = loadAllMessages();
const messageKeys = new Set(flattenMessageKeys(messages["zh-CN"]));
const usageRe = /\b(?:t|tI18n)\(\s*(["'`])([^"'`$]+)\1/g;
const legacyTranslationPrefixes = [
    "costumes.",
    "events.",
    "cards.",
    "music.",
    "materials.",
    "mysekai.",
    "gacha.",
];

const dynamicKeyPrefixes = [
    "common.cardSupplyTypes.",
    "common.eventTypes.",
    "common.status.",
    "settings.serverSource.",
];

const missing = [];

for (const filePath of walkSourceFiles(SRC_ROOT)) {
    if (filePath.includes("/lib/i18n/messages/") || filePath.includes("\\lib\\i18n\\messages\\")) {
        continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lineStarts = [0];
    for (let i = 0; i < content.length; i += 1) {
        if (content[i] === "\n") lineStarts.push(i + 1);
    }

    for (const match of content.matchAll(usageRe)) {
        const key = match[2];
        if (key.includes("${")) continue;
        if (legacyTranslationPrefixes.some((prefix) => key === prefix.slice(0, -1) || key.startsWith(prefix))) continue;
        if (dynamicKeyPrefixes.some((prefix) => key === prefix || key.startsWith(prefix))) continue;
        if (messageKeys.has(key)) continue;

        const index = match.index ?? 0;
        let lineNumber = 1;
        for (let i = 0; i < lineStarts.length; i += 1) {
            if (lineStarts[i] > index) break;
            lineNumber = i + 1;
        }
        missing.push(formatLine(filePath, lineNumber, `missing key \"${key}\"`));
    }
}

if (missing.length > 0) {
    console.error(`Missing i18n keys referenced by literal t()/tI18n() calls (${missing.length}):`);
    for (const item of missing) console.error(`  ${item}`);
    process.exit(1);
}

console.log("Literal i18n usage keys OK.");
