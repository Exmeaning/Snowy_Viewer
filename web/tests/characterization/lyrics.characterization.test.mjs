import assert from "node:assert/strict";
import test from "node:test";

import {
  baseline,
  importWebTypeScript,
  REPO_ROOT,
  readJson,
  readWeb,
} from "./test-helpers.mjs";
import fs from "node:fs";
import path from "node:path";

const fixture = readJson("tests/fixtures/lyrics-published.json");

async function importLyrics() {
  return importWebTypeScript("src/lib/lyrics.ts", [[
    'import { TRANSLATION_BASE_URL } from "@/lib/translations";',
    `const TRANSLATION_BASE_URL = ${JSON.stringify(baseline.baseline.translationBaseUrl)};`,
  ]]);
}

test("lyrics loaders consume only the published index and music detail artifact paths", async () => {
  assert.match(readWeb("src/lib/lyrics.ts"), /const LYRICS_DETAIL_CACHE_LIMIT = 24/);
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => String(url).endsWith("/index.json") ? structuredClone(fixture.index) : structuredClone(fixture.document),
    };
  };
  const lyrics = await importLyrics();

  assert.deepEqual(await lyrics.fetchLyricsIndex(), fixture.index);
  assert.deepEqual(await lyrics.fetchLyricsDocument(1), fixture.document);
  assert.deepEqual(requests.map(({ url }) => url), [
    `${baseline.baseline.translationBaseUrl}/lyrics/index.json`,
    `${baseline.baseline.translationBaseUrl}/lyrics/1.json`,
  ]);
  assert.ok(requests.every(({ options }) => options.cache === "no-store"));

  await lyrics.fetchLyricsIndex();
  await lyrics.fetchLyricsDocument(1);
  assert.equal(requests.length, 2, "successful artifacts remain in bounded memory caches");
});

test("lyrics loader rejects missing and malformed artifacts without manufacturing content", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const missing = await importLyrics();
  await assert.rejects(missing.fetchLyricsDocument(99), (error) => error.name === "LyricsLoadError" && error.status === 404);

  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ schemaVersion: 1, items: "invalid" }) });
  const malformed = await importLyrics();
  await assert.rejects(malformed.fetchLyricsIndex(), /Invalid lyrics index/);

  const duplicateLineDocument = structuredClone(fixture.document);
  duplicateLineDocument.lines.push(structuredClone(duplicateLineDocument.lines[0]));
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => duplicateLineDocument });
  const duplicateLines = await importLyrics();
  await assert.rejects(duplicateLines.fetchLyricsDocument(1), /Invalid lyrics document/);
});

test("lyrics detail cache evicts the least recently used document at its fixed bound", async () => {
  let fetchCount = 0;
  globalThis.fetch = async (url) => {
    fetchCount += 1;
    const musicId = Number(new URL(String(url)).pathname.match(/\/(\d+)\.json$/)?.[1]);
    const document = structuredClone(fixture.document);
    document.musicId = musicId;
    return { ok: true, status: 200, json: async () => document };
  };
  const lyrics = await importLyrics();

  for (let musicId = 1; musicId <= 25; musicId += 1) {
    await lyrics.fetchLyricsDocument(musicId);
  }
  assert.equal(fetchCount, 25);
  await lyrics.fetchLyricsDocument(25);
  assert.equal(fetchCount, 25, "the newest detail remains cached");
  await lyrics.fetchLyricsDocument(1);
  assert.equal(fetchCount, 26, "the oldest detail is fetched again after eviction");
});

test("lyrics target locale is limited to zh-CN and en-US with Japanese fallback elsewhere", async () => {
  const lyrics = await importLyrics();
  assert.equal(lyrics.getLyricsTargetLocale("zh-CN"), "zh-CN");
  assert.equal(lyrics.getLyricsTargetLocale("en-US"), "en-US");
  assert.equal(lyrics.getLyricsTargetLocale("ja-JP"), null);
  assert.equal(lyrics.getLyricsTargetLocale("zh-TW"), null);
  assert.equal(lyrics.getLyricsTargetLocale("ko-KR"), null);
});

test("single-performer colors meet WCAG contrast in light and dark surfaces", async () => {
  const colors = await importWebTypeScript("src/lib/lyrics-colors.ts", [[
    'import { CHAR_COLORS } from "@/types/types";',
    `const CHAR_COLORS = ${JSON.stringify(baseline.charColors)};`,
  ]]);
  for (const [characterId, color] of Object.entries(baseline.charColors)) {
    const adjusted = colors.getLyricsPerformerColors(Number(characterId));
    assert.equal(adjusted.base, color);
    assert.ok(colors.contrastRatio(adjusted.light, "#ffffff") >= 4.5, `${color} light contrast`);
    assert.ok(colors.contrastRatio(adjusted.dark, "#0f172a") >= 4.5, `${color} dark contrast`);
  }
  assert.equal(colors.getLyricsPerformerColors(999), null);
});

test("performer rendering uses only CHAR_COLORS and preserves single, multi, and 3+ accessibility", () => {
  const source = readWeb("src/components/lyrics/LyricText.tsx");
  const colorSource = readWeb("src/lib/lyrics-colors.ts");
  assert.match(colorSource, /import \{ CHAR_COLORS \} from "@\/types\/types";/);
  assert.match(colorSource, /const base = CHAR_COLORS\[String\(characterId\)\]/);
  assert.doesNotMatch(colorSource, /Record<.*string.*string>|"1":\s*"#/);
  assert.match(source, /getLyricsPerformerColors/);
  assert.match(source, /performers\.length === 1/);
  assert.match(source, /--performer-light/);
  assert.match(source, /dark:text-\[var\(--performer-dark\)\]/);
  assert.match(source, /aria-label=\{ariaLabel\}/);
  assert.match(source, /performers\.length > 1/);
  assert.match(source, /performers\.map\(\(performer\)/);
  assert.match(source, /rounded-full/);
  assert.doesNotMatch(source, /gradient/);
  assert.match(source, /leading-none/);
  assert.match(source, /whitespace-nowrap/);
  assert.doesNotMatch(source, /flex-wrap/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.deepEqual(fixture.document.lines.map((line) => line.performerIds.length), [1, 2, 4, 0]);
});

test("lyrics list and detail retain loading, empty, error, long-line, mobile, and dark contracts", () => {
  const list = readWeb("src/app/lyrics/client.tsx");
  const detail = readWeb("src/app/lyrics/[musicId]/client.tsx");
  const musicItem = readWeb("src/components/music/MusicItem.tsx");
  const layout = readWeb("src/components/music/music-layout.ts");

  assert.match(list, /fetchLyricsIndex\(\)/);
  assert.match(list, /<MusicFilters/);
  assert.match(list, /<MusicItem/);
  assert.match(list, /hrefBase="\/lyrics"/);
  assert.match(list, /loading-spinner|animate-pulse/);
  assert.match(list, /page\.lyrics\.empty/);
  assert.match(list, /role="alert"/);
  assert.match(detail, /grid grid-cols-1/);
  assert.match(detail, /md:grid-cols-2/);
  assert.match(detail, /dark:border-slate-700/);
  assert.match(detail, /translated \|\| line\.source/);
  assert.match(detail, /<LyricText/);
  assert.match(layout, /grid-cols-2 sm:grid-cols-3 md:grid-cols-4/);
  assert.match(musicItem, /hrefBase = "\/music"/);
  assert.match(musicItem, /const itemHref = href \?\? `\$\{hrefBase\}\/\$\{music\.id\}`/);
});

test("search keeps n/cn, adds en, and music list no longer waits for search index", () => {
  const palette = readWeb("src/components/CommandPalette.tsx");
  const music = readWeb("src/app/music/client.tsx");
  assert.match(palette, /n: string/);
  assert.match(palette, /cn\?: string/);
  assert.match(palette, /en\?: string/);
  assert.match(palette, /item\.cn && item\.cn\.toLowerCase\(\)\.includes\(q\)/);
  assert.match(palette, /item\.en && item\.en\.toLowerCase\(\)\.includes\(q\)/);
  assert.match(palette, /useDeferredValue\(query\)/);
  assert.match(palette, /Aliases are optional and must not delay the primary multilingual index/);
  assert.match(music, /const \[musicEnMap/);
  assert.match(music, /englishTitle\.toLowerCase\(\)\.includes\(query\)/);
  assert.match(music, /useDeferredValue\(searchQuery\)/);
  assert.match(readWeb("src/app/lyrics/client.tsx"), /useDeferredValue\(searchQuery\)/);

  const essentialBlock = music.slice(
    music.indexOf("const [musicsData, tagsData, difficultiesData, eventMusicsData]"),
    music.indexOf("// Normalize musics data"),
  );
  assert.doesNotMatch(essentialBlock, /search-index\.json/);
  assert.match(music, /fetch\("https:\/\/translation\.exmeaning\.com\/data\/search-index\.json"\)[\s\S]*\.catch/);
});

test("lyrics navigation and SEO are registered without changing the music detail route", () => {
  const navigation = readWeb("src/lib/navigation.ts");
  const routes = readWeb("src/lib/seo-routes-data.json");
  const keywords = readWeb("src/lib/seo-keywords.ts");
  assert.match(navigation, /\{ href: "\/music" \},\s*\{ href: "\/lyrics" \},\s*\{ href: "\/music\/meta" \}/);
  assert.match(routes, /"path": "\/lyrics\/", "pageKey": "lyrics"/);
  assert.match(keywords, /lyrics: definePage\(\s*"\/lyrics"/);
  assert.match(keywords, /lyrics: \{ "zh-CN": "歌词详情"/);
  assert.match(readWeb("src/app/lyrics/[musicId]/page.tsx"), /createDynamicDetailMetadata/);
  assert.match(readWeb("src/app/music/[id]/page.tsx"), /defineMusicDetailClientPage/);
});

test("translation coverage artifacts are exhaustive, internally counted, and retain required gaps", () => {
  const coverage = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "docs/translation-coverage.json"), "utf8"));
  const requiredFields = ["id", "routes", "components", "sourceType", "sourceFiles", "fields", "stableId", "backendMapping", "zh", "en", "status", "exclusion"];
  for (const entry of coverage.entries) {
    for (const field of requiredFields) assert.ok(field in entry, `${entry.id} missing ${field}`);
  }
  const counts = coverage.entries.reduce((result, entry) => {
    result[entry.status] = (result[entry.status] ?? 0) + 1;
    return result;
  }, {});
  assert.equal(coverage.summary.entries, coverage.entries.length);
  assert.equal(coverage.summary.covered, counts.covered);
  assert.equal(coverage.summary.partial, counts.partial);
  assert.equal(coverage.summary.requiredUncovered, counts["required-uncovered"]);
  assert.equal(coverage.summary.officialRegional, counts["official-regional"]);
  assert.equal(coverage.summary.excluded, counts.excluded);
  assert.equal(coverage.summary.nontext, counts.nontext);
  assert.ok(counts["required-uncovered"] > 0);

  const ids = new Set(coverage.entries.map((entry) => entry.id));
  for (const id of ["event-story-lines", "unit-story-lines", "card-story-lines", "area-story-lines", "self-story-lines", "special-story-lines", "story-special-effects", "lyrics-index", "lyrics-detail"]) {
    assert.ok(ids.has(id), id);
  }
  assert.match(coverage.policy.uiMessages, /checked-in artifacts/);
  assert.match(fs.readFileSync(path.join(REPO_ROOT, "docs/translation-coverage.md"), "utf8"), /no full-coverage claim/i);
});
