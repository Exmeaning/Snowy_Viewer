import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");

function readWeb(relativePath) {
    return fs.readFileSync(path.join(WEB_ROOT, relativePath), "utf8");
}

const coverage = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs/translation-coverage.json"), "utf8"));
const markdown = fs.readFileSync(path.join(REPO_ROOT, "docs/translation-coverage.md"), "utf8");
const entriesById = new Map(coverage.entries.map((entry) => [entry.id, entry]));
const requiredEntryFields = [
    "id",
    "routes",
    "components",
    "sourceType",
    "sourceFiles",
    "fields",
    "stableId",
    "backendMapping",
    "zh",
    "en",
    "status",
    "exclusion",
];

assert.equal(entriesById.size, coverage.entries.length, "coverage IDs must be unique");
for (const entry of coverage.entries) {
    for (const field of requiredEntryFields) {
        assert.ok(field in entry, `${entry.id} is missing ${field}`);
    }
}

const counts = coverage.entries.reduce((result, entry) => {
    result[entry.status] = (result[entry.status] ?? 0) + 1;
    return result;
}, {});
assert.deepEqual(coverage.summary, {
    entries: coverage.entries.length,
    covered: counts.covered ?? 0,
    partial: counts.partial ?? 0,
    requiredUncovered: counts["required-uncovered"] ?? 0,
    officialRegional: counts["official-regional"] ?? 0,
    excluded: counts.excluded ?? 0,
    nontext: counts.nontext ?? 0,
});
assert.ok((counts["required-uncovered"] ?? 0) > 0, "required gaps must prevent a full-coverage claim");
assert.match(markdown, /no full-coverage claim/i);

const translationSource = readWeb("src/lib/translations.ts");
const translationInterface = translationSource.slice(
    translationSource.indexOf("export interface TranslationData"),
    translationSource.indexOf("// Default empty translation data"),
);
const translationCategories = [...translationInterface.matchAll(/^    ([A-Za-z][A-Za-z0-9]*): \{$/gm)]
    .map((match) => match[1]);
assert.ok(translationCategories.length > 0, "TranslationData categories must be source-derived");
for (const category of translationCategories) {
    const artifact = `translation/${category}.json`;
    assert.ok(
        coverage.entries.some((entry) => entry.sourceFiles.some((sourceFile) => sourceFile.includes(artifact))),
        `TranslationData category ${category} is absent from the inventory`,
    );
}

const storyRoot = path.join(WEB_ROOT, "src/app/story");
const storyFamilies = fs.readdirSync(storyRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => ["event", "unit", "card", "area", "self", "special"].includes(name));
for (const family of storyFamilies) {
    assert.ok(entriesById.has(`${family}-story-lines`), `${family} story source has no coverage entry`);
}

const eventGroupSource = readWeb("src/app/story/event/[eventId]/client.tsx");
const eventGroupEntries = [entriesById.get("event-story-metadata"), entriesById.get("event-story-summaries")];
assert.ok(eventGroupEntries.every(Boolean), "event group metadata and summary entries are required");
const documentedEventFields = eventGroupEntries.flatMap((entry) => entry.fields).join(" ");
for (const field of ["title_jp", "title_cn", "outline_jp", "outline_cn", "summary_cn"]) {
    assert.match(eventGroupSource, new RegExp(`\\b${field}\\b`), `${field} is no longer an event group source field`);
    assert.match(documentedEventFields, new RegExp(`\\b${field}\\b`), `${field} is missing from event coverage`);
}

const lyricsSource = readWeb("src/lib/lyrics.ts");
const lyricsDetail = entriesById.get("lyrics-detail");
const lyricsIndex = entriesById.get("lyrics-index");
assert.ok(lyricsDetail && lyricsIndex, "lyrics index and detail entries are required");
for (const field of ["source", "translations", "performerIds", "attribution"]) {
    assert.match(lyricsSource, new RegExp(`\\b${field}\\b`));
    assert.ok(lyricsDetail.fields.some((documented) => documented.includes(field)), `lyrics detail omits ${field}`);
}
for (const field of ["musicId", "titles", "availableLocales"]) {
    assert.match(lyricsSource, new RegExp(`\\b${field}\\b`));
    assert.ok(lyricsIndex.fields.some((documented) => documented.includes(field)), `lyrics index omits ${field}`);
}

const lyricsPage = readWeb("src/app/lyrics/[musicId]/page.tsx");
const lyricsClient = readWeb("src/app/lyrics/[musicId]/client.tsx");
const lyricText = readWeb("src/components/lyrics/LyricText.tsx");
assert.match(lyricsPage, /getPublishedLyricsIndexEntry/);
assert.match(lyricsPage, /notFound\(\)/);
assert.match(lyricsClient, /lyrics\.attribution/);
assert.match(lyricText, /performer\.shortName/);
assert.match(lyricText, /--performer-light/);
assert.match(lyricText, /--performer-dark/);

console.log(`Translation coverage source validation OK (${translationCategories.length} categories, ${storyFamilies.length} story families, ${coverage.entries.length} entries).`);
