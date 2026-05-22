#!/usr/bin/env node
import { flattenMessageKeys, loadAllMessages } from "./i18n-utils.mjs";

const messages = loadAllMessages();
const zhKeys = new Set(flattenMessageKeys(messages["zh-CN"]));
const enKeys = new Set(flattenMessageKeys(messages["en-US"]));

const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key)).sort();
const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key)).sort();

if (missingInEn.length > 0 || missingInZh.length > 0) {
    console.error("i18n message key mismatch detected.");

    if (missingInEn.length > 0) {
        console.error(`\nMissing in en-US (${missingInEn.length}):`);
        for (const key of missingInEn) console.error(`  - ${key}`);
    }

    if (missingInZh.length > 0) {
        console.error(`\nMissing in zh-CN (${missingInZh.length}):`);
        for (const key of missingInZh) console.error(`  - ${key}`);
    }

    process.exit(1);
}

console.log(`i18n key structure OK (${zhKeys.size} keys).`);
