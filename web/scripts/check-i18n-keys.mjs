#!/usr/bin/env node
import { flattenMessageKeys, loadAllMessages } from "./i18n-utils.mjs";

const messages = loadAllMessages();
const localeKeys = Object.fromEntries(
    Object.entries(messages).map(([locale, messageTree]) => [locale, new Set(flattenMessageKeys(messageTree))])
);
const baseLocale = "zh-CN";
const baseKeys = localeKeys[baseLocale];
const mismatches = [];

for (const [locale, keys] of Object.entries(localeKeys)) {
    if (locale === baseLocale) continue;

    const missingInLocale = [...baseKeys].filter((key) => !keys.has(key)).sort();
    const missingInBase = [...keys].filter((key) => !baseKeys.has(key)).sort();

    if (missingInLocale.length > 0 || missingInBase.length > 0) {
        mismatches.push({ locale, missingInLocale, missingInBase });
    }
}

if (mismatches.length > 0) {
    console.error("i18n message key mismatch detected.");

    for (const mismatch of mismatches) {
        if (mismatch.missingInLocale.length > 0) {
            console.error(`\nMissing in ${mismatch.locale} (${mismatch.missingInLocale.length}):`);
            for (const key of mismatch.missingInLocale) console.error(`  - ${key}`);
        }

        if (mismatch.missingInBase.length > 0) {
            console.error(`\nMissing in ${baseLocale} compared to ${mismatch.locale} (${mismatch.missingInBase.length}):`);
            for (const key of mismatch.missingInBase) console.error(`  - ${key}`);
        }
    }

    process.exit(1);
}

console.log(`i18n key structure OK (${baseKeys.size} keys across ${Object.keys(localeKeys).length} locales).`);
