import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import ts from "typescript";

import {
  baseline,
  importTypeScriptSource,
  importWebTypeScript,
  REPO_ROOT,
  readJson,
  readWeb,
} from "./test-helpers.mjs";
import fs from "node:fs";
import path from "node:path";

const TRANSLATION_ROOT_URL = "https://translation.exmeaning.com/files/translation";
const fixture = {
  index: readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json"),
  document: readJson("tests/fixtures/next-public-lyrics-v1/detail.fixture.json"),
};

async function importLyrics() {
  return importWebTypeScript("src/lib/lyrics.ts", [[
    'import { TRANSLATION_BASE_URL } from "@/lib/translations";',
    `const TRANSLATION_BASE_URL = ${JSON.stringify(TRANSLATION_ROOT_URL)};`,
  ]]);
}

async function importLyricsDetailLayout() {
  let source = readWeb("src/app/lyrics/[musicId]/layout.tsx");
  const substitutions = [
    [
      'import type { ReactNode } from "react";',
      "type ReactNode = unknown;",
    ],
    [
      'import { fetchLyricsDocument, isLyricsUnavailableError } from "@/lib/lyrics";',
      `const fetchLyricsDocument = async (musicId) => {
  globalThis.__lyricsDetailSeoTest.calls.push(["document", musicId]);
  if (globalThis.__lyricsDetailSeoTest.error) throw globalThis.__lyricsDetailSeoTest.error;
  return globalThis.__lyricsDetailSeoTest.document;
};
const isLyricsUnavailableError = (error) => error?.status === 404;`,
    ],
    [
      'import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";',
      `const defineLyricsDetailClientPage = () => {
  const page = () => null;
  page.generateMetadata = async ({ params }) => {
    const resolvedParams = await params;
    globalThis.__lyricsDetailSeoTest.calls.push(["detailMetadata", resolvedParams]);
    return { kind: "published-metadata", resolvedParams };
  };
  return page;
};`,
    ],
    [
      'import { createDetailFallbackMetadata } from "@/lib/seo-metadata";',
      `const createDetailFallbackMetadata = async (...args) => {
  globalThis.__lyricsDetailSeoTest.calls.push(["fallbackMetadata", ...args]);
  return { kind: "fallback-metadata", args };
};`,
    ],
    ['import LyricsDetailClient from "./client";', 'const LyricsDetailClient = () => null;'],
  ];
  for (const [from, to] of substitutions) {
    assert.ok(source.includes(from), `missing lyrics detail test substitution: ${from}`);
    source = source.replace(from, to);
  }
  return importTypeScriptSource(source, "lyrics-detail-layout");
}

async function importLyricsDetailPage() {
  let source = readWeb("src/app/lyrics/[musicId]/page.tsx");
  const substitutions = [
    [
      'import { notFound } from "next/navigation";',
      `const notFound = () => {
  globalThis.__lyricsDetailSeoTest.calls.push(["notFound"]);
  throw globalThis.__lyricsDetailSeoTest.notFoundError;
};`,
    ],
    [
      'import { fetchLyricsDocument, isLyricsUnavailableError } from "@/lib/lyrics";',
      `const fetchLyricsDocument = async (musicId) => {
  globalThis.__lyricsDetailSeoTest.calls.push(["document", musicId]);
  if (globalThis.__lyricsDetailSeoTest.error) throw globalThis.__lyricsDetailSeoTest.error;
  return globalThis.__lyricsDetailSeoTest.document;
};
const isLyricsUnavailableError = (error) => error?.status === 404;`,
    ],
    [
      'import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";',
      `const defineLyricsDetailClientPage = () => async ({ params }) => {
  const resolvedParams = await params;
  globalThis.__lyricsDetailSeoTest.calls.push(["detailPage", resolvedParams]);
  return "published-detail-page";
};`,
    ],
    ['import LyricsDetailClient from "./client";', 'const LyricsDetailClient = () => null;'],
    [
      'return <Page params={Promise.resolve({ id: musicId })} />;',
      'return Page({ params: Promise.resolve({ id: musicId }) });',
    ],
  ];
  for (const [from, to] of substitutions) {
    assert.ok(source.includes(from), `missing lyrics detail test substitution: ${from}`);
    source = source.replace(from, to);
  }
  return importTypeScriptSource(source, "lyrics-detail-page");
}

async function importLyricsNotFound(locale) {
  const source = readWeb("src/app/lyrics/[musicId]/not-found.tsx")
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?;\s*$/gmu, "");
  globalThis.__lyricsNotFoundRuntime = {
    React,
    locale,
    copy: locale === "zh-CN"
      ? { "page.lyrics.notFound": "未找到该歌曲的歌词", "page.lyrics.backToList": "返回歌词列表" }
      : { "page.lyrics.notFound": "Lyrics were not found for this song", "page.lyrics.backToList": "Back to lyrics" },
  };
  const prelude = `
    const dependencies = globalThis.__lyricsNotFoundRuntime;
    const React = dependencies.React;
    const MainLayout = ({ children }) => React.createElement("div", { "data-layout": true }, children);
    const Link = ({ children, ...props }) => React.createElement("a", props, children);
    const getRequestSeoLocale = async () => dependencies.locale;
    const messagesByLocale = { [dependencies.locale]: dependencies.copy };
    const fallbackMessages = dependencies.copy;
    const getMessageByPath = (messages, key) => messages[key] ?? null;
  `;
  const transpiled = ts.transpileModule(`${prelude}\n${source}`, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "src/app/lyrics/[musicId]/not-found.tsx",
    reportDiagnostics: true,
  });
  assert.deepEqual(
    (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error),
    [],
  );
  const encoded = Buffer.from(`${transpiled.outputText}\n//# locale=${locale}`).toString("base64");
  return (await import(`data:text/javascript;base64,${encoded}`)).default;
}

let lyricsClientModuleSequence = 0;

async function importLyricsDetailClient(lyrics) {
  lyricsClientModuleSequence += 1;
  const source = readWeb("src/app/lyrics/[musicId]/client.tsx")
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?;\s*$/gmu, "");
  const prelude = `
    const dependencies = globalThis.__lyricsClientRuntimeTest;
    const React = dependencies.React;
    const { useEffect, useState } = React;
    const { Image, useParams, MainLayout, LyricText, Link, useI18n, useTheme,
      fetchMasterData, fetchLyricsDocument, getLyricsTargetLocale,
      isLyricsUnavailableError, getMusicJacketUrl } = dependencies;
  `;
  const transpiled = ts.transpileModule(`${prelude}\n${source}`, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "src/app/lyrics/[musicId]/client.tsx",
    reportDiagnostics: true,
  });
  assert.deepEqual(
    (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error),
    [],
  );
  const encoded = Buffer.from(
    `${transpiled.outputText}\n//# sourceURL=lyrics-detail-client-${lyricsClientModuleSequence}.mjs`,
  ).toString("base64");

  const state = { error: null };
  const translate = (key) => key;
  globalThis.__lyricsClientRuntimeTest = {
    React,
    Image: (props) => React.createElement("img", props),
    useParams: () => ({ musicId: "10" }),
    MainLayout: ({ children }) => React.createElement("main", null, children),
    LyricText: ({ text }) => React.createElement("span", null, text),
    Link: ({ children, ...props }) => React.createElement("a", props, children),
    useI18n: function useI18n() {
      return { locale: "en-US", t: translate };
    },
    useTheme: () => ({ assetSource: "main" }),
    fetchMasterData: async () => [],
    fetchLyricsDocument: async () => { throw state.error; },
    getLyricsTargetLocale: lyrics.getLyricsTargetLocale,
    isLyricsUnavailableError: lyrics.isLyricsUnavailableError,
    getMusicJacketUrl: () => "/jacket.webp",
  };
  return { Client: (await import(`data:text/javascript;base64,${encoded}`)).default, state };
}

async function renderLyricsClientFailure(lyrics, error) {
  const { Client, state } = await importLyricsDetailClient(lyrics);
  state.error = error;
  const element = React.createElement(Client);
  const serverHtml = renderToString(element);
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${serverHtml}</div></body></html>`, {
    url: "https://pjsk.moe/en-us/lyrics/10/",
  });
  const previousGlobals = {
    window: globalThis.window,
    document: globalThis.document,
  };
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });
  const recoverableErrors = [];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.getElementById("root");
  let root;
  try {
    await act(async () => {
      root = hydrateRoot(container, element, {
        onRecoverableError: (recoverableError) => recoverableErrors.push(recoverableError),
      });
      await new Promise((resolve) => setImmediate(resolve));
    });
    assert.deepEqual(recoverableErrors, []);
    return container.textContent;
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of Object.entries(previousGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
    delete globalThis.__lyricsClientRuntimeTest;
  }
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
  assert.deepEqual(await lyrics.fetchLyricsDocument(10), fixture.document);
  assert.deepEqual(requests.map(({ url }) => url), [
    `${TRANSLATION_ROOT_URL}/lyrics/index.json`,
    `${TRANSLATION_ROOT_URL}/lyrics/music_10.json`,
  ]);
  assert.ok(requests.every(({ options }) => options.cache === "no-store" && options.signal instanceof AbortSignal));

  await lyrics.fetchLyricsIndex();
  await lyrics.fetchLyricsDocument(10);
  assert.equal(requests.length, 2, "successful artifacts remain in bounded memory caches");
});

test("public lyrics fetches enforce an internal timeout and response byte cap", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-length": String((4 << 20) + 1) }),
    body: null,
    json: async () => fixture.index,
  });
  const oversized = await importLyrics();
  await assert.rejects(oversized.fetchLyricsIndex(), /too large/);

  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  try {
    globalThis.setTimeout = (callback, delay) => {
      assert.equal(delay, 10_000);
      queueMicrotask(callback);
      return 1;
    };
    globalThis.clearTimeout = () => {};
    globalThis.fetch = async (_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    });
    const timedOut = await importLyrics();
    await assert.rejects(timedOut.fetchLyricsIndex(), /timed out/);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("simultaneous lyrics index callers share one in-flight request and validated result", async () => {
  let releaseFetch;
  const fetchGate = new Promise((resolve) => {
    releaseFetch = resolve;
  });
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    await fetchGate;
    return { ok: true, status: 200, json: async () => structuredClone(fixture.index) };
  };
  const lyrics = await importLyrics();

  const first = lyrics.fetchLyricsIndex();
  const concurrent = lyrics.fetchLyricsIndex();
  assert.equal(fetchCount, 1, "concurrent callers must reuse indexRequest");

  releaseFetch();
  const [firstIndex, concurrentIndex] = await Promise.all([first, concurrent]);
  assert.strictEqual(concurrentIndex, firstIndex, "both callers resolve the same validated index object");
  assert.deepEqual(firstIndex, fixture.index);
  assert.equal(fetchCount, 1);
});

test("lyrics publication lookup gates detail routes on the published index", async () => {
  const originalNow = Date.now;
  let now = 100_000;
  let nextIndex = structuredClone(fixture.index);
  let failure = null;
  let fetchCount = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    fetchCount += 1;
    if (failure) throw failure;
    return { ok: true, status: 200, json: async () => structuredClone(nextIndex) };
  };

  try {
    const lyrics = await importLyrics();
    assert.match(readWeb("src/lib/lyrics.ts"), /const LYRICS_INDEX_CACHE_TTL = 60 \* 1000/);

    assert.deepEqual(await lyrics.getPublishedLyricsIndexEntry(10), fixture.index.songs[0]);
    assert.equal(await lyrics.getPublishedLyricsIndexEntry(999), null);
    assert.equal(await lyrics.getPublishedLyricsIndexEntry(Number.NaN), null);
    assert.equal(fetchCount, 1, "publication checks share the fresh validated index cache");

    nextIndex.songs = nextIndex.songs.filter((item) => item.musicId !== 10);
    now += 60_001;
    assert.equal(await lyrics.getPublishedLyricsIndexEntry(10), null, "unpublication is observed after bounded revalidation");
    assert.equal(fetchCount, 2);

    nextIndex = structuredClone(fixture.index);
    now += 60_001;
    assert.deepEqual(await lyrics.getPublishedLyricsIndexEntry(10), fixture.index.songs[0], "publication is observed without a process restart");
    assert.equal(fetchCount, 3);

    now += 60_001;
    failure = new Error("temporary index failure");
    await assert.rejects(lyrics.getPublishedLyricsIndexEntry(10), /temporary index failure/);
    failure = null;
    assert.deepEqual(await lyrics.getPublishedLyricsIndexEntry(10), fixture.index.songs[0], "an expired failure remains retryable instead of becoming a false 404");
    assert.equal(fetchCount, 5);
  } finally {
    Date.now = originalNow;
  }

  const page = readWeb("src/app/lyrics/[musicId]/page.tsx");
  const layout = readWeb("src/app/lyrics/[musicId]/layout.tsx");
  assert.match(page, /fetchLyricsDocument/);
  assert.match(page, /isLyricsUnavailableError/);
  assert.match(layout, /createDetailFallbackMetadata\("lyrics"/);
  assert.match(page, /if \(!await hasAvailableLyrics\(Number\(musicId\)\)\) notFound\(\)/);
});

test("lyrics detail SEO and page require an available detail while preserving upstream failures", async () => {
  const notFoundError = new Error("NEXT_NOT_FOUND");
  const state = {
    document: fixture.document,
    error: { status: 404 },
    notFoundError,
    calls: [],
  };
  globalThis.__lyricsDetailSeoTest = state;

  try {
    const layout = await importLyricsDetailLayout();
    const page = await importLyricsDetailPage();

    assert.deepEqual(await layout.generateMetadata({ params: Promise.resolve({ musicId: "999" }) }), {
      kind: "fallback-metadata",
      args: ["lyrics", "/lyrics/999", "summary"],
    });
    assert.deepEqual(state.calls, [
      ["document", 999],
      ["fallbackMetadata", "lyrics", "/lyrics/999", "summary"],
    ]);
    state.calls.length = 0;

    await assert.rejects(
      page.default({ params: Promise.resolve({ musicId: "999" }) }),
      (error) => error === notFoundError,
    );
    assert.deepEqual(state.calls, [
      ["document", 999],
      ["notFound"],
    ]);

    state.error = null;
    state.calls.length = 0;
    assert.deepEqual(await layout.generateMetadata({ params: Promise.resolve({ musicId: "1" }) }), {
      kind: "published-metadata",
      resolvedParams: { id: "1" },
    });
    assert.deepEqual(await page.default({ params: Promise.resolve({ musicId: "1" }) }), "published-detail-page");
    assert.deepEqual(state.calls, [
      ["document", 1],
      ["detailMetadata", { id: "1" }],
      ["document", 1],
      ["detailPage", { id: "1" }],
    ]);

    state.error = { status: 503, message: "upstream unavailable" };
    state.calls.length = 0;
    await assert.rejects(
      layout.generateMetadata({ params: Promise.resolve({ musicId: "10" }) }),
      (error) => error === state.error,
    );
    await assert.rejects(
      page.default({ params: Promise.resolve({ musicId: "10" }) }),
      (error) => error === state.error,
    );
    assert.deepEqual(state.calls, [["document", 10], ["document", 10]]);

    state.error = new Error("malformed lyrics payload");
    state.calls.length = 0;
    await assert.rejects(
      layout.generateMetadata({ params: Promise.resolve({ musicId: "10" }) }),
      (error) => error === state.error,
    );
    await assert.rejects(
      page.default({ params: Promise.resolve({ musicId: "10" }) }),
      (error) => error === state.error,
    );
    assert.deepEqual(state.calls, [["document", 10], ["document", 10]]);
  } finally {
    delete globalThis.__lyricsDetailSeoTest;
  }

  const preset = readWeb("src/lib/seo-detail-metadata.ts");
  assert.match(preset, /kind: "lyrics",[\s\S]*routePrefix: "lyrics",[\s\S]*parentPageKey: "lyrics", entity: \{ type: "MusicRecording" \}/);
  assert.match(readWeb("src/app/lyrics/[musicId]/page.tsx"), /defineLyricsDetailClientPage\(LyricsDetailClient\)/);
  assert.match(readWeb("src/app/lyrics/[musicId]/layout.tsx"), /export async function generateMetadata/);
  assert.match(readWeb("src/lib/seo-metadata.ts"), /createDetailFallbackMetadata[\s\S]*robots: missingDetailRobots\(\)/);
});

test("lyrics segment not-found boundary renders localized 404 copy without detail data", async () => {
  try {
    const EnglishNotFound = await importLyricsNotFound("en-US");
    const englishHtml = renderToString(await EnglishNotFound());
    assert.match(englishHtml, /Lyrics were not found for this song/);
    assert.match(englishHtml, /Back to lyrics/);
    assert.doesNotMatch(englishHtml, /<main(?:\s|>)/, "MainLayout owns the page's only main landmark");

    const ChineseNotFound = await importLyricsNotFound("zh-CN");
    const chineseHtml = renderToString(await ChineseNotFound());
    assert.match(chineseHtml, /未找到该歌曲的歌词/);
    assert.match(chineseHtml, /返回歌词列表/);

    const source = readWeb("src/app/lyrics/[musicId]/not-found.tsx");
    assert.doesNotMatch(source, /application\/ld\+json|attribution|fetchLyrics/);
    assert.doesNotMatch(source, /<main(?:\s|>)/);
  } finally {
    delete globalThis.__lyricsNotFoundRuntime;
  }
});

test("lyrics loader rejects missing and malformed artifacts without manufacturing content", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const missing = await importLyrics();
  await assert.rejects(missing.fetchLyricsDocument(99), (error) => missing.isLyricsUnavailableError(error));

  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const unavailable = await importLyrics();
  await assert.rejects(
    unavailable.fetchLyricsDocument(99),
    (error) => error.name === "LyricsLoadError" && error.status === 503 && !unavailable.isLyricsUnavailableError(error),
  );

  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ version: 1, songs: "invalid" }) });
  const malformed = await importLyrics();
  await assert.rejects(malformed.fetchLyricsIndex(), /Invalid lyrics index/);

  const duplicateLineDocument = structuredClone(fixture.document);
  duplicateLineDocument.lines.push(structuredClone(duplicateLineDocument.lines[0]));
  globalThis.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => String(url).endsWith("/index.json") ? structuredClone(fixture.index) : duplicateLineDocument,
  });
  const duplicateLines = await importLyrics();
  await assert.rejects(duplicateLines.fetchLyricsDocument(10), /Invalid lyrics document/);

  const privateFieldDocument = structuredClone(fixture.document);
  privateFieldDocument.sourceUrl = "https://private.example/source";
  globalThis.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => String(url).endsWith("/index.json") ? structuredClone(fixture.index) : privateFieldDocument,
  });
  const privateFields = await importLyrics();
  await assert.rejects(privateFields.fetchLyricsDocument(10), /Invalid lyrics document/);
});

test("lyrics detail client localizes 404 races and separates upstream failures without leaking errors", async () => {
  const lyrics = await importLyrics();
  const unavailableMessage = "private unavailable artifact location";
  const unavailableText = await renderLyricsClientFailure(
    lyrics,
    new lyrics.LyricsLoadError(unavailableMessage, 404),
  );
  assert.match(unavailableText, /page\.lyrics\.notFound/);
  assert.doesNotMatch(unavailableText, /page\.lyrics\.error/);
  assert.doesNotMatch(unavailableText, new RegExp(unavailableMessage));

  const failureMessage = "private upstream response";
  const failedText = await renderLyricsClientFailure(
    lyrics,
    new lyrics.LyricsLoadError(failureMessage, 503),
  );
  assert.match(failedText, /page\.lyrics\.error/);
  assert.doesNotMatch(failedText, /page\.lyrics\.notFound/);
  assert.doesNotMatch(failedText, new RegExp(failureMessage));
});

test("lyrics detail cache evicts the least recently used document at its fixed bound", async () => {
  let fetchCount = 0;
  globalThis.fetch = async (url) => {
    fetchCount += 1;
    if (String(url).endsWith("/index.json")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          version: 1,
          songs: Array.from({ length: 25 }, (_, index) => ({
            musicId: index + 1,
            revision: 1,
            updatedAt: fixture.index.songs[0].updatedAt,
            title: { "ja-JP": `song-${index + 1}` },
          })),
        }),
      };
    }
    const musicId = Number(new URL(String(url)).pathname.match(/\/music_(\d+)\.json$/)?.[1]);
    const document = structuredClone(fixture.document);
    document.musicId = musicId;
    document.revision = 1;
    return { ok: true, status: 200, json: async () => document };
  };
  const lyrics = await importLyrics();

  for (let musicId = 1; musicId <= 25; musicId += 1) {
    await lyrics.fetchLyricsDocument(musicId);
  }
  assert.equal(fetchCount, 26);
  await lyrics.fetchLyricsDocument(25);
  assert.equal(fetchCount, 26, "the newest detail remains cached");
  await lyrics.fetchLyricsDocument(1);
  assert.equal(fetchCount, 27, "the oldest detail is fetched again after eviction");
});

test("lyrics detail cache is revision-keyed, TTL-bounded, and rejects unsynchronized detail bytes", async () => {
  const originalNow = Date.now;
  let now = 100_000;
  let revision = 3;
  let detailRevision = 3;
  let indexFetches = 0;
  let detailFetches = 0;
  Date.now = () => now;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/index.json")) {
      indexFetches += 1;
      const index = structuredClone(fixture.index);
      index.songs[0].revision = revision;
      return { ok: true, status: 200, json: async () => index };
    }
    detailFetches += 1;
    const document = structuredClone(fixture.document);
    document.revision = detailRevision;
    return { ok: true, status: 200, json: async () => document };
  };

  try {
    const lyrics = await importLyrics();
    assert.match(readWeb("src/lib/lyrics.ts"), /const LYRICS_DETAIL_CACHE_TTL = 60 \* 1000/);
    assert.equal((await lyrics.fetchLyricsDocument(10)).revision, 3);
    now += 59_999;
    assert.equal((await lyrics.fetchLyricsDocument(10)).revision, 3);
    assert.equal(detailFetches, 1);

    now += 2;
    assert.equal((await lyrics.fetchLyricsDocument(10)).revision, 3);
    assert.equal(indexFetches, 2);
    assert.equal(detailFetches, 2, "same-revision details revalidate after the TTL");

    now += 60_001;
    revision = 4;
    detailRevision = 3;
    await assert.rejects(lyrics.fetchLyricsDocument(10), /Invalid lyrics document/);
    detailRevision = 4;
    assert.equal((await lyrics.fetchLyricsDocument(10)).revision, 4);
    assert.equal(detailFetches, 4, "revision mismatch is not cached and remains retryable");
  } finally {
    Date.now = originalNow;
  }
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
    assert.ok(colors.contrastRatio(adjusted.light, "#f1f5f9") >= 3, `${color} light marker contrast`);
    assert.ok(colors.contrastRatio(adjusted.dark, "#1e293b") >= 3, `${color} dark marker contrast`);
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
  assert.match(source, /performer\.shortName/);
  assert.match(source, /title=\{performer\.name\}/);
  assert.match(source, /bg-\[var\(--performer-light\)\]/);
  assert.match(source, /dark:bg-\[var\(--performer-dark\)\]/);
  assert.doesNotMatch(source, /backgroundColor: performer\.colors\.base/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.deepEqual(fixture.document.lines[0].segments[0].performerIds, [1]);
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
  assert.match(detail, /translated \|\| line\.japanese/);
  assert.match(detail, /line\.segments\.map/);
  assert.match(detail, /segment\.performerIds/);
  assert.match(detail, /<LyricText/);
  assert.match(detail, /lyrics\.attribution/);
  assert.match(detail, /page\.lyrics\.attribution/);
  assert.ok(fixture.document.attribution);
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
  assert.match(readWeb("src/app/lyrics/[musicId]/page.tsx"), /defineLyricsDetailClientPage/);
  assert.match(readWeb("src/app/music/[id]/page.tsx"), /defineMusicDetailClientPage/);
});

test("lyrics static SEO has native zh-TW and ko-KR copy instead of English fallback", async () => {
  const zhTW = await importWebTypeScript("src/lib/seo-zh-tw.ts");
  const dependencyKey = "__moesekaiSeoDependencies";
  globalThis[dependencyKey] = zhTW;
  const seo = await importWebTypeScript("src/lib/seo-keywords.ts", [
    [
      'import { DEFAULT_UI_LOCALE, type UiLocale } from "@/lib/i18n/locales";',
      'const DEFAULT_UI_LOCALE = "zh-CN";\ntype UiLocale = "zh-CN" | "zh-TW" | "en-US" | "ja-JP" | "ko-KR";',
    ],
    [
      'import { interpolateMessage, type MessageInterpolationValues } from "@/lib/i18n/format";',
      'const interpolateMessage = (message: string) => message;\ntype MessageInterpolationValues = Record<string, string | number>;',
    ],
    [
      `import {
  ZH_TW_DETAIL_FALLBACK_DESCRIPTIONS,
  ZH_TW_DETAIL_FALLBACK_TITLES,
  ZH_TW_DETAIL_SEO_TEMPLATES,
  ZH_TW_DYNAMIC_SEO_TEMPLATES,
  ZH_TW_SEO_PAGE_METADATA,
} from "@/lib/seo-zh-tw";`,
      `const {
  ZH_TW_DETAIL_FALLBACK_DESCRIPTIONS,
  ZH_TW_DETAIL_FALLBACK_TITLES,
  ZH_TW_DETAIL_SEO_TEMPLATES,
  ZH_TW_DYNAMIC_SEO_TEMPLATES,
  ZH_TW_SEO_PAGE_METADATA,
} = globalThis.${dependencyKey};`,
    ],
  ]);

  const traditional = seo.getPageSeo("lyrics", "zh-TW");
  const korean = seo.getPageSeo("lyrics", "ko-KR");
  assert.equal(traditional.title, "歌詞資料庫");
  assert.match(traditional.description, /已發布的歌曲歌詞/);
  assert.ok(traditional.keywords.includes("歌詞翻譯"));
  assert.equal(korean.title, "가사 라이브러리");
  assert.match(korean.description, /공개된 노래 가사/);
  assert.ok(korean.keywords.includes("가사 번역"));
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
  for (const id of ["soundtrack-masterdata-text", "event-story-summaries", "event-story-lines", "unit-story-lines", "card-story-lines", "area-story-lines", "self-story-lines", "special-story-lines", "story-special-effects", "lyrics-index", "lyrics-detail"]) {
    assert.ok(ids.has(id), id);
  }
  assert.match(coverage.policy.uiMessages, /checked-in artifacts/);
  assert.match(fs.readFileSync(path.join(REPO_ROOT, "docs/translation-coverage.md"), "utf8"), /no full-coverage claim/i);

  const sourceCheck = spawnSync(process.execPath, ["web/scripts/check-translation-coverage.mjs"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  assert.equal(sourceCheck.status, 0, sourceCheck.stderr || sourceCheck.stdout);
  assert.match(sourceCheck.stdout, /13 translation categories, 24 rendered masterdata families, 6 story families, 47 entries/);
});
