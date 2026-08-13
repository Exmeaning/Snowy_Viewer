import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";
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

const SOURCE_BASE_URL = "https://lyrics.example.test/public";
const LOOPBACK_BASE_URLS = [
  "http://127.0.0.1/public",
  "http://localhost/public",
  "http://127.0.0.42/public",
  "http://[::1]/public",
];
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVICE_UNAVAILABLE = 503;
const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
const MAX_TCP_PORT = 65_535;
const LOOPBACK_TEST_PORTS = [DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT, MAX_TCP_PORT].map(String);
const SINGLE_INCREMENT = 1;
const OVERSIZED_BYTE_INCREMENT = SINGLE_INCREMENT;
const STRICT_JSON_MAX_DEPTH = 64;
const STRICT_JSON_OVERFLOW_DEPTH = STRICT_JSON_MAX_DEPTH + SINGLE_INCREMENT;
const JSON_ROOT_MEMBER_DEPTH = 2;
const MAX_TEST_LYRICS_PERFORMERS = 64;
const MOEGIRL_PUBLIC_EXACT_REVISION_URL = "https://zh.moegirl.org.cn/%E4%BA%BF%E5%B9%B4%E7%88%B1%E6%81%8B";
const fixture = {
  index: readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json"),
  document: readJson("tests/fixtures/next-public-lyrics-v1/detail.fixture.json"),
  vocaloidOnlyDocument: readJson("tests/fixtures/next-public-lyrics-v1/detail-vocaloid-only.fixture.json"),
};
const fixtureV2 = {
  index: readJson("tests/fixtures/next-public-lyrics-v2/index.fixture.json"),
  document: readJson("tests/fixtures/next-public-lyrics-v2/detail.fixture.json"),
  fullOnlyDocument: readJson("tests/fixtures/next-public-lyrics-v2/detail-full-only.fixture.json"),
  gameOnlyDocument: readJson("tests/fixtures/next-public-lyrics-v2/detail-game-only.fixture.json"),
};
const creditsPresentationFixture = readJson("tests/fixtures/lyrics-credits-presentation.fixture.json");
const fixtureV2MoegirlAttribution = fixtureV2.document.attributions.find((attribution) => attribution.provider === "moegirl_public_exact");
assert.ok(fixtureV2MoegirlAttribution, "canonical v2 detail fixture must include the exact public Moegirl attribution");
assert.equal(fixtureV2MoegirlAttribution.revisionUrl, MOEGIRL_PUBLIC_EXACT_REVISION_URL);
const fixturePublication = fixture.index.songs.find((song) => song.musicId === fixture.document.musicId);
const fixtureV2Publication = fixtureV2.index.songs.find((song) => song.musicId === fixtureV2.document.musicId);
const fixtureV2FullOnlyPublication = fixtureV2.index.songs.find((song) => song.musicId === fixtureV2.fullOnlyDocument.musicId);
const fixtureV2GameOnlyPublication = fixtureV2.index.songs.find((song) => song.musicId === fixtureV2.gameOnlyDocument.musicId);
assert.ok(fixturePublication, "canonical v1 detail fixture must be published by the canonical v1 index fixture");
assert.equal(fixture.vocaloidOnlyDocument.musicId, fixturePublication.musicId);
assert.equal(fixture.vocaloidOnlyDocument.revision, fixturePublication.revision);
assert.equal(fixture.vocaloidOnlyDocument.updatedAt, fixturePublication.updatedAt);
assert.ok(fixtureV2Publication, "canonical v2 detail fixture must be published by the canonical v2 index fixture");
assert.ok(fixtureV2FullOnlyPublication, "canonical v2 Full-only fixture must be published by the canonical v2 index fixture");
assert.ok(fixtureV2GameOnlyPublication, "canonical v2 Game-only fixture must be published by the canonical v2 index fixture");

const SEKAIPEDIA_ATTRIBUTION = {
  provider: "sekaipedia",
  title: "新曲",
  revisionId: 2468,
  revisionUrl: "https://www.sekaipedia.org/wiki/New_Song?oldid=2468",
  licenseName: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

function v3Line(id, japanese, performerIds) {
  return {
    id,
    order: 0,
    japanese,
    "zh-CN": `${japanese}译文`,
    "en-US": `${japanese} translation`,
    segments: [{ text: japanese, performerIds, ruby: [{ text: japanese }] }],
    trailingPerformerIds: [],
  };
}

function v3Attributions(key, components) {
  return components.map(component => ({
    ...SEKAIPEDIA_ATTRIBUTION,
    component: `renditions/${key}/${component}`,
  }));
}

const fixtureV3 = {
  version: 3,
  musicId: 902,
  revision: 337500,
  updatedAt: "2026-08-07T12:00:00Z",
  state: "complete",
  renditions: [
    {
      key: "sekai",
      kind: "sekai",
      label: "SEKAI",
      availableVersions: ["full", "game"],
      performers: [{ performerId: "miku", name: "初音ミク", color: "#33CCBB" }],
      full: { version: { kind: "sekai", label: "Full" }, lines: [v3Line("sekai-full-1", "SEKAI", ["miku"])] },
      game: { version: { kind: "sekai", label: "Game" }, lines: [v3Line("sekai-game-1", "SEKAI", ["miku"])] },
      relation: { kind: "exact_projection", fullRenditionKey: "sekai", lineIds: ["sekai-full-1"] },
      sourceTabPaths: [["SEKAI", "Full"], ["SEKAI", "Game"]],
      provenance: v3Attributions("sekai", ["full_text", "full_performer_segmentation", "full_ruby", "game_text", "game_performer_segmentation", "game_ruby", "relation", "version"]),
      translationCredits: { translation: "译者", proofreading: "译者" },
    },
    {
      key: "virtual-singer",
      kind: "vocaloid",
      label: "VIRTUAL SINGER",
      availableVersions: ["game"],
      performers: [{ performerId: "miku", name: "初音ミク", color: "#33CCBB" }],
      game: { version: { kind: "vocaloid", label: "Game" }, lines: [v3Line("vs-game-1", "VIRTUAL", ["miku"])] },
      relation: { kind: "none" },
      sourceTabPaths: [["VIRTUAL SINGER", "Game"]],
      provenance: v3Attributions("virtual-singer", ["game_text", "game_performer_segmentation", "game_ruby", "version"]),
      translationCredits: { translation: "独立译者" },
    },
  ],
};

function strictV3ProjectionFixture() {
  const detail = structuredClone(fixtureV3);
  const rendition = detail.renditions[0];
  const fullLines = [
    {
      id: "full-1",
      order: 0,
      japanese: "初音",
      "zh-CN": "初音",
      "en-US": "Hatsune",
      segments: [{ text: "初音", performerIds: ["miku"], ruby: [{ text: "初音", reading: "はつね" }] }],
      trailingPerformerIds: [],
    },
    {
      id: "full-2",
      order: 1,
      japanese: "歌う",
      "zh-CN": "歌唱",
      "en-US": "Sing",
      stanzaBreakBefore: true,
      segments: [{ text: "歌う", performerIds: ["miku"], ruby: [{ text: "歌", reading: "うた" }, { text: "う" }] }],
      trailingPerformerIds: ["miku"],
    },
  ];
  const gameLine = structuredClone(fullLines[1]);
  gameLine.id = "game-1";
  gameLine.order = 0;
  rendition.full.lines = fullLines;
  rendition.game.lines = [gameLine];
  rendition.relation.lineIds = ["full-2"];
  detail.renditions = [rendition];
  return detail;
}

function v3IndexForDetail(detail) {
  const versions = new Set(detail.renditions.flatMap((rendition) => rendition.availableVersions));
  const availableVersions = versions.has("full") && versions.has("game")
    ? ["full", "game"]
    : versions.has("full") ? ["full"] : ["game"];
  return {
    version: 3,
    songs: [{
      musicId: detail.musicId,
      revision: detail.revision,
      updatedAt: detail.updatedAt,
      title: { "ja-JP": "新曲", "zh-CN": "新曲", "en-US": "New Song" },
      state: detail.state,
      availableVersions,
    }],
  };
}

function jsonResponse(value, overrides = {}) {
  return rawJsonResponse(JSON.stringify(value), overrides);
}

function rawJsonResponse(body, overrides = {}) {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  return new Response(bytes, {
    status: HTTP_OK,
    headers: {
      "content-type": "application/json",
      "content-length": String(bytes.byteLength),
    },
    ...overrides,
  });
}

function nestedJsonValueAtDepth(depth, startingDepth = SINGLE_INCREMENT) {
  return `${"[".repeat(depth - startingDepth)}0${"]".repeat(depth - startingDepth)}`;
}

function replaceRawJsonToken(body, token, replacement, label) {
  const replaced = body.replace(token, replacement);
  assert.notEqual(replaced, body, `raw JSON mutation must match ${label}`);
  return replaced;
}

async function importLyrics() {
  const lyricsBaseUrl = pathToFileURL(path.join(REPO_ROOT, "web/src/lib/public-lyrics-base-url.mjs")).href;
  const strictJsonUrl = pathToFileURL(path.join(REPO_ROOT, "web/src/lib/strict-json.mjs")).href;
  return importWebTypeScript("src/lib/lyrics.ts", [
    [
      'import { DEFAULT_PUBLIC_LYRICS_BASE_URL } from "@/lib/public-lyrics-base-url.mjs";',
      `import { DEFAULT_PUBLIC_LYRICS_BASE_URL } from "${lyricsBaseUrl}";`,
    ],
    [
      'import { parseStrictJson } from "@/lib/strict-json.mjs";',
      `import { parseStrictJson } from "${strictJsonUrl}";`,
    ],
  ]);
}

let lyricTextModuleSequence = 0;

async function importLyricText() {
  lyricTextModuleSequence += SINGLE_INCREMENT;
  const source = readWeb("src/components/lyrics/LyricText.tsx")
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?;\s*$/gmu, "");
  const prelude = `
    const dependencies = globalThis.__lyricTextRuntimeTest;
    const React = dependencies.React;
    const Image = ({ fill: _fill, unoptimized: _unoptimized, ...props }) => React.createElement("img", props);
    const useI18n = () => ({ t: (key) => key });
    const getCharacterName = (_t, id) => \`character-\${id}\`;
    const getCharacterIconUrl = (id) => \`/character-\${id}.webp\`;
    const adjustHexForContrast = (color) => color;
    const getLyricsPerformerColors = (id) => dependencies.colors.get(id) ?? null;
    const getExternalLyricsPerformer = (id) => dependencies.external.get(id) ?? null;
    const getExternalLyricsPerformerBySourceId = (sourceId) =>
      [...dependencies.external.values()].find((item) => item.sourceId === sourceId) ?? null;
    const getLyricsCharacterIdBySourceId = (sourceId) => {
      const match = /^歌唱者-(\\d+)$/.exec(sourceId);
      const characterId = match ? Number(match[1]) : null;
      return characterId >= 1 && characterId <= 26 ? characterId : null;
    };
  `;
  const transpiled = ts.transpileModule(`${prelude}\n${source}`, {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "src/components/lyrics/LyricText.tsx",
    reportDiagnostics: true,
  });
  assert.deepEqual(
    (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error),
    [],
  );
  const encoded = Buffer.from(
    `${transpiled.outputText}\n//# sourceURL=lyric-text-${lyricTextModuleSequence}.mjs`,
  ).toString("base64");
  return (await import(`data:text/javascript;base64,${encoded}`)).default;
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
const isLyricsUnavailableError = (error) => error?.status === globalThis.__lyricsDetailSeoTest.notFoundStatus;`,
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
const isLyricsUnavailableError = (error) => error?.status === globalThis.__lyricsDetailSeoTest.notFoundStatus;`,
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
      'return <Page params={Promise.resolve({ id: String(canonicalMusicId) })} />;',
      'return Page({ params: Promise.resolve({ id: String(canonicalMusicId) }) });',
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
  lyricsClientModuleSequence += SINGLE_INCREMENT;
  const source = readWeb("src/app/lyrics/[musicId]/client.tsx")
    .replace(/^"use client";\s*/u, "")
    .replace(/^import[\s\S]*?;\s*$/gmu, "");
  const prelude = `
    const dependencies = globalThis.__lyricsClientRuntimeTest;
    const React = dependencies.React;
    const { useEffect, useState, useRef } = React;
    const { Image, useParams, useSearchParams, ExternalLink, MainLayout, LyricText, Link, useBreadcrumb, useI18n, useTheme,
      fetchLyricsMusicById, fetchLyricsDocument, fetchMasterData, getLyricsDisplayLines, getLyricsDisplaySegments, getLyricsRendition, getLyricsRenditions,
      getLyricsTargetLocale, hasFullLyricsVersion, hasGameLyricsVersion, isLyricsUnavailableError, replaceCurrentUrlSearchParams,
      getPublishedLyricsIndexEntry, getMusicJacketUrl, MUSIC_CATEGORY_COLORS, TranslatedText, fetchMasterData, getCharacterIconUrl, getMusicVocalAudioUrl, getCharacterName } = dependencies;
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

  const state = {
    error: null,
    document: null,
    publication: null,
    musics: [],
    musicId: fixture.document.musicId,
    search: "",
    replacedSearch: null,
    translations: {},
  };
  const translate = (key) => state.translations[key] ?? key;
  globalThis.__lyricsClientRuntimeTest = {
    React,
    Image: ({ fill: _fill, unoptimized: _unoptimized, priority: _priority, ...props }) => React.createElement("img", props),
    useParams: () => ({ musicId: String(state.musicId) }),
    useSearchParams: () => new URLSearchParams(state.search),
    ExternalLink: ({ children, ...props }) => React.createElement("a", props, children),
    MainLayout: ({ children }) => React.createElement("main", null, children),
    useBreadcrumb: () => ({ setDetailName: () => {} }),
    LyricText: ({ text = "", performerIds = [], ruby, segments, trailingPerformerIds = [] }) => React.createElement("span", {
      "data-lyric-trailing-performers": trailingPerformerIds.join(","),
    }, (segments ?? [{ text, performerIds, ruby: ruby ?? [] }]).map((segment, index) => React.createElement("span", {
      key: index,
      "data-lyric-performers": segment.performerIds.join(","),
      "data-lyric-ruby": (segment.ruby ?? []).map((span) => span.reading ? `${span.text}:${span.reading}` : span.text).join("|"),
    }, segment.text))),
    Link: ({ children, ...props }) => React.createElement("a", props, children),
    TranslatedText: ({ original, category, field }) => React.createElement("span", { "data-translated-category": category, "data-translated-field": field }, original),
    useI18n: function useI18n() {
      return { locale: "en-US", t: translate, formatDate: (value) => String(value) };
    },
    useTheme: () => ({ assetSource: "main" }),
    fetchLyricsMusicById: async (musicId) => state.musics.find((music) => music.id === musicId) ?? null,
    fetchMasterData: async (file) => {
      const name = String(file);
      if (name.toLowerCase().includes("vocal")) return [];
      if (name.toLowerCase().includes("outside")) return {};
      return name.endsWith(".json") ? [] : {};
    },
    getCharacterIconUrl: (id) => `/character-${id}.webp`,
    getMusicVocalAudioUrl: (name, _source) => `/audio/${name}.mp3`,
    getCharacterName: (_t, id) => `character-${id}`,
    getPublishedLyricsIndexEntry: async (musicId) => {
      if (state.publication) return state.publication;
      const sourceIndex = state.document?.version === 2 ? fixtureV2.index : fixture.index;
      return sourceIndex.songs.find((song) => song.musicId === musicId) ?? null;
    },
    fetchLyricsDocument: async () => {
      if (state.error) throw state.error;
      return state.document;
    },
    fetchMasterData: async () => [],
    getLyricsDisplayLines: lyrics.getLyricsDisplayLines,
    getLyricsDisplaySegments: lyrics.getLyricsDisplaySegments,
    getLyricsRendition: lyrics.getLyricsRendition,
    getLyricsRenditions: lyrics.getLyricsRenditions,
    getLyricsTargetLocale: lyrics.getLyricsTargetLocale,
    hasFullLyricsVersion: lyrics.hasFullLyricsVersion,
    hasGameLyricsVersion: lyrics.hasGameLyricsVersion,
    isLyricsUnavailableError: lyrics.isLyricsUnavailableError,
    replaceCurrentUrlSearchParams: (params) => { state.replacedSearch = params.toString(); },
    getMusicJacketUrl: () => "/jacket.webp",
    MUSIC_CATEGORY_COLORS: {},
  };
  return { Client: (await import(`data:text/javascript;base64,${encoded}`)).default, state };
}

async function renderLyricsClientRuntime(lyrics, configure, interact) {
  const { Client, state } = await importLyricsDetailClient(lyrics);
  configure(state);
  const element = React.createElement(Client);
  const serverHtml = renderToString(element);
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${serverHtml}</div></body></html>`, {
    url: new URL(`/en-us/lyrics/${state.musicId}/${state.search ? `?${state.search}` : ""}`, SOURCE_BASE_URL).toString(),
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
    if (interact) {
      await act(async () => {
        await interact({ container, state, window: dom.window });
        await new Promise((resolve) => setImmediate(resolve));
      });
    }
    assert.deepEqual(recoverableErrors, []);
    return { text: container.textContent, html: container.innerHTML, state };
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

async function renderLyricsClientFailure(lyrics, error) {
  const result = await renderLyricsClientRuntime(lyrics, (state) => { state.error = error; });
  return result.text;
}

test("lyrics source config fails closed and permits only credential-free HTTPS or development loopback HTTP", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
  };
  try {
    process.env.NODE_ENV = "development";
    for (const configured of LOOPBACK_BASE_URLS) {
      process.env.NEXT_PUBLIC_LYRICS_BASE_URL = `${configured}/`;
      const lyrics = await importLyrics();
      const configuredUrl = new URL(configured);
      configuredUrl.pathname = configuredUrl.pathname.replace(/\/+$/, "");
      assert.equal(lyrics.getLyricsBaseUrl(), configuredUrl.toString().replace(/\/$/, ""));
    }
    const loopbackWithPort = new URL(LOOPBACK_BASE_URLS[0]);
    for (const port of LOOPBACK_TEST_PORTS) {
      const configured = new URL(loopbackWithPort);
      configured.port = port;
      process.env.NEXT_PUBLIC_LYRICS_BASE_URL = configured.toString();
      const lyrics = await importLyrics();
      assert.equal(lyrics.getLyricsBaseUrl(), configured.toString().replace(/\/$/, ""));
    }

    for (const unsafe of [
      "http://example.test/public",
      "http://backend/public",
      "https://user:password@example.test/public",
      "https://example.test/public?token=secret",
      `${SOURCE_BASE_URL}?`,
      `${SOURCE_BASE_URL}#`,
      `${SOURCE_BASE_URL}?#`,
      "https://example.test/",
      ` ${SOURCE_BASE_URL}`,
      "http://127.999.0.1/public",
      "not-a-url",
    ]) {
      process.env.NEXT_PUBLIC_LYRICS_BASE_URL = unsafe;
      const lyrics = await importLyrics();
      assert.throws(() => lyrics.getLyricsBaseUrl(), /Invalid configured lyrics base URL/, unsafe);
    }

    delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    let lyrics = await importLyrics();
    assert.equal(
      lyrics.getLyricsBaseUrl(),
      "https://translation.exmeaning.com/translation/lyrics",
      "missing config uses the reviewed production Public Lyrics directory",
    );

    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = LOOPBACK_BASE_URLS[0];
    lyrics = await importLyrics();
    assert.throws(
      () => lyrics.getLyricsBaseUrl(),
      /Invalid configured lyrics base URL/,
      "production rejects plaintext loopback config",
    );

    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = `${SOURCE_BASE_URL}/`;
    lyrics = await importLyrics();
    assert.equal(lyrics.getLyricsBaseUrl(), SOURCE_BASE_URL);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("lyrics source changes invalidate source-scoped index and detail caches", { concurrency: false }, async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
  };
  const alternateBaseUrl = new URL("alternate", SOURCE_BASE_URL).toString().replace(/\/$/, "");
  const previousFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    const requests = [];
    globalThis.fetch = async (url) => {
      requests.push(String(url));
      return jsonResponse(String(url).endsWith("/index.json") ? structuredClone(fixture.index) : structuredClone(fixture.document));
    };
    const lyrics = await importLyrics();

    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
    await lyrics.fetchLyricsDocument(fixture.document.musicId);
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = alternateBaseUrl;
    await lyrics.fetchLyricsDocument(fixture.document.musicId);

    assert.deepEqual(requests, [
      `${SOURCE_BASE_URL}/index.json`,
      `${SOURCE_BASE_URL}/music_${fixture.document.musicId}.json`,
      `${alternateBaseUrl}/index.json`,
      `${alternateBaseUrl}/music_${fixture.document.musicId}.json`,
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("lyrics loaders consume only the configured index and published detail artifact paths", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
  };
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const requests = [];
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse(String(url).endsWith("/index.json") ? structuredClone(fixture.index) : structuredClone(fixture.document));
    };
    const lyrics = await importLyrics();

    const index = await lyrics.fetchLyricsIndex();
    const document = await lyrics.fetchLyricsDocument(fixture.document.musicId);
    assert.deepEqual(index, fixture.index);
    assert.deepEqual(document, fixture.document);
    assert.equal(index.songs.find((song) => song.musicId === document.musicId)?.updatedAt, document.updatedAt);
    assert.deepEqual(requests.map(({ url }) => url), [
      `${SOURCE_BASE_URL}/index.json`,
      `${SOURCE_BASE_URL}/music_${fixture.document.musicId}.json`,
    ]);
    assert.ok(requests.every(({ options }) => options.cache === "no-store" && options.signal instanceof AbortSignal));

    await lyrics.fetchLyricsIndex();
    await lyrics.fetchLyricsDocument(fixture.document.musicId);
    assert.equal(requests.length, 2, "successful artifacts remain in bounded memory caches");
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Public Lyrics v1 accepts bounded empty performer assignments for Vocaloid-only rollout details", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => jsonResponse(
      String(url).endsWith("/index.json")
        ? structuredClone(fixture.index)
        : structuredClone(fixture.vocaloidOnlyDocument),
    );
    const lyrics = await importLyrics();
    const document = await lyrics.fetchLyricsDocument(fixture.vocaloidOnlyDocument.musicId);
    const line = document.lines[0];

    assert.deepEqual(document, fixture.vocaloidOnlyDocument);
    assert.deepEqual(lyrics.getLyricsAvailableVersions(document), ["full"]);
    assert.equal(line["zh-CN"], "");
    assert.equal(line["en-US"], "");
    assert.equal(line.segments.length, SINGLE_INCREMENT);
    assert.equal(line.segments[0].text, line.japanese, "the empty assignment still covers the complete v1 line");
    assert.deepEqual(line.segments[0].performerIds, []);
    assert.deepEqual(lyrics.getLyricsDisplaySegments(line), [{
      text: line.japanese,
      performerIds: [],
      ruby: [{ text: line.japanese }],
    }], "legacy Vocaloid-only fallback remains one unboxed whole-line display segment");

    const invalidPerformerAssignments = [
      [1, 1],
      [0],
      [1.5],
      Array.from({ length: MAX_TEST_LYRICS_PERFORMERS + SINGLE_INCREMENT }, (_value, index) => index + SINGLE_INCREMENT),
    ];
    for (const performerIds of invalidPerformerAssignments) {
      const invalidDocument = structuredClone(fixture.vocaloidOnlyDocument);
      invalidDocument.lines[0].segments[0].performerIds = performerIds;
      globalThis.fetch = async (url) => jsonResponse(
        String(url).endsWith("/index.json") ? structuredClone(fixture.index) : invalidDocument,
      );
      const invalidLyrics = await importLyrics();
      await assert.rejects(
        invalidLyrics.fetchLyricsDocument(invalidDocument.musicId),
        /Invalid lyrics document/,
      );
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v2 loads complete and explicit Game-only details while text-free states stay index-only", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/index.json")) return jsonResponse(structuredClone(fixtureV2.index));
      if (requestUrl.endsWith(`/music_${fixtureV2.document.musicId}.json`)) return jsonResponse(structuredClone(fixtureV2.document));
      if (requestUrl.endsWith(`/music_${fixtureV2.fullOnlyDocument.musicId}.json`)) return jsonResponse(structuredClone(fixtureV2.fullOnlyDocument));
      if (requestUrl.endsWith(`/music_${fixtureV2.gameOnlyDocument.musicId}.json`)) return jsonResponse(structuredClone(fixtureV2.gameOnlyDocument));
      return new Response(null, { status: HTTP_NOT_FOUND });
    };
    const lyrics = await importLyrics();
    const index = await lyrics.fetchLyricsIndex();
    const dual = await lyrics.fetchLyricsDocument(fixtureV2.document.musicId);
    const fullOnly = await lyrics.fetchLyricsDocument(fixtureV2.fullOnlyDocument.musicId);
    const gameOnly = await lyrics.fetchLyricsDocument(fixtureV2.gameOnlyDocument.musicId);

    assert.deepEqual(index, fixtureV2.index);
    assert.deepEqual(dual, fixtureV2.document);
    assert.deepEqual(fullOnly, fixtureV2.fullOnlyDocument);
    assert.deepEqual(gameOnly, fixtureV2.gameOnlyDocument);
    assert.deepEqual(lyrics.getLyricsAvailableVersions(fixture.document), ["full"]);
    assert.deepEqual(lyrics.getLyricsAvailableVersions(dual), ["full", "game"]);
    assert.deepEqual(lyrics.getLyricsAvailableVersions(gameOnly), ["game"]);
    assert.equal(lyrics.hasFullLyricsVersion(gameOnly), false);
    assert.equal(lyrics.hasGameLyricsVersion(gameOnly), true);
    assert.deepEqual(lyrics.getLyricsDisplayLines(dual, "full").map((line) => line.id), ["line-1", "line-2", "line-3"]);
    assert.deepEqual(lyrics.getLyricsDisplayLines(dual, "game").map((line) => line.id), dual.gameProjection.lineIds);
    assert.equal(lyrics.getLyricsDisplayLines(dual, "game")[0], dual.lines[0], "Game is a projection over the same Full line objects");
    assert.deepEqual(lyrics.getLyricsDisplayLines(fullOnly, "game"), fullOnly.lines, "unavailable Game requests fail back to Full");
    assert.deepEqual(lyrics.getLyricsDisplayLines(gameOnly, "full"), gameOnly.lines, "Game-only text is never relabeled or projected as Full");
    assert.deepEqual(gameOnly.lines[0].segments[0].performerIds, []);
    assert.deepEqual(gameOnly.lines[0].trailingPerformerIds, [1, 2]);
    assert.deepEqual(dual.lines[2].segments[0].performerIds, []);
    assert.deepEqual(dual.lines[2].trailingPerformerIds, [2]);
    const noDetailPublication = fixtureV2.index.songs.find((song) => song.state === "satisfied_no_lyrics");
    assert.ok(noDetailPublication);
    assert.deepEqual(lyrics.getLyricsAvailableVersions(noDetailPublication), []);
    assert.equal(lyrics.hasLyricsDetail(noDetailPublication), false);
    await assert.rejects(
      lyrics.fetchLyricsDocument(noDetailPublication.musicId),
      (error) => error.status === HTTP_NOT_FOUND,
    );
    assert.deepEqual(lyrics.getLyricsRubySpans(fixture.document.lines[0].segments[0]), [{ text: fixture.document.lines[0].segments[0].text }]);
    assert.deepEqual(lyrics.getLyricsRubySpans(dual.lines[0].segments[0]), dual.lines[0].segments[0].ruby);
    assert.deepEqual(
      lyrics.getLyricsDisplaySegments(dual.lines[1]).map((segment) => segment.performerIds),
      [[1, 2]],
      "shared authoritative performer assignments stay structured for display",
    );
    assert.deepEqual(fullOnly.lines[0].segments[0].performerIds, []);
    assert.equal(fullOnly.lines[0]["zh-CN"], "");
    assert.equal(fullOnly.lines[0]["en-US"], "");

    const splitFallbackLine = structuredClone(fullOnly.lines[0]);
    splitFallbackLine.segments = [
      {
        text: "長い",
        performerIds: [],
        ruby: structuredClone(fullOnly.lines[0].segments[0].ruby.slice(0, 2)),
      },
      {
        text: "歌詞",
        performerIds: [],
        ruby: structuredClone(fullOnly.lines[0].segments[0].ruby.slice(2)),
      },
    ];
    const fallbackDisplay = lyrics.getLyricsDisplaySegments(splitFallbackLine);
    assert.equal(fallbackDisplay.length, SINGLE_INCREMENT, "unassigned fallback segments collapse to one clean lyric line");
    assert.equal(fallbackDisplay[0].text, splitFallbackLine.japanese);
    assert.deepEqual(fallbackDisplay[0].performerIds, []);
    assert.deepEqual(fallbackDisplay[0].ruby, fullOnly.lines[0].segments[0].ruby);
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v2 accepts only the reviewed complete public Moegirl URL for the exact provider", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const index = structuredClone(fixtureV2.index);
    const detail = structuredClone(fixtureV2.document);
    const attribution = detail.attributions.find((item) => item.provider === "moegirl_public_exact");
    assert.ok(attribution);
    assert.equal(attribution.revisionUrl, MOEGIRL_PUBLIC_EXACT_REVISION_URL);

    let calls = 0;
    globalThis.fetch = async (url) => {
      calls += SINGLE_INCREMENT;
      return jsonResponse(String(url).endsWith("/index.json") ? index : detail);
    };
    const lyrics = await importLyrics();
    const document = await lyrics.fetchLyricsDocument(detail.musicId);
    const accepted = document.attributions.find((item) => item.provider === "moegirl_public_exact");
    assert.equal(accepted?.revisionUrl, MOEGIRL_PUBLIC_EXACT_REVISION_URL);
    assert.equal(calls, SINGLE_INCREMENT * 2);
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v2 accepts Sekaipedia only with its exact public license pair", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const detail = structuredClone(fixtureV2.document);
    detail.attributions.push(structuredClone(SEKAIPEDIA_ATTRIBUTION));
    globalThis.fetch = async (url) => jsonResponse(
      String(url).endsWith("/index.json") ? structuredClone(fixtureV2.index) : detail,
    );
    const lyrics = await importLyrics();
    const document = await lyrics.fetchLyricsDocument(detail.musicId);

    assert.deepEqual(document.attributions, detail.attributions);
    assert.deepEqual(document.attributions.at(-1), SEKAIPEDIA_ATTRIBUTION);
    assert.deepEqual(document.lines, fixtureV2.document.lines, "attribution expansion must not alter ruby or performer segmentation");
    assert.deepEqual(lyrics.getLyricsDisplaySegments(document.lines[1]).map((segment) => segment.performerIds), [[1, 2]]);
    assert.deepEqual(document.lines[0].segments[0].ruby, fixtureV2.document.lines[0].segments[0].ruby);
    assert.equal("privateReview" in document, false);
    assert.equal("revisionTimestamp" in document.attributions.at(-1), false);
    assert.equal("romaji" in document.lines[0], false);
    assert.equal("rawEvidence" in document.attributions.at(-1), false);
    assert.equal("internal" in document, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v2 translation credits accept exact values and reject empty, untrimmed, or open shapes", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    for (const credits of [creditsPresentationFixture.same, creditsPresentationFixture.distinct]) {
      const detail = structuredClone(fixtureV2.document);
      detail.translationCredits = structuredClone(credits);
      globalThis.fetch = async (url) => jsonResponse(
        String(url).endsWith("/index.json") ? structuredClone(fixtureV2.index) : detail,
      );
      const lyrics = await importLyrics();
      assert.deepEqual(
        (await lyrics.fetchLyricsDocument(detail.musicId)).translationCredits,
        credits,
      );
    }

    const invalidCases = [
      ["empty object", {}],
      ["untrimmed translation", { translation: ` ${creditsPresentationFixture.same.translation}` }],
      ["untrimmed proofreading", { proofreading: `${creditsPresentationFixture.same.proofreading} ` }],
      ["unknown field", { ...creditsPresentationFixture.same, reviewer: "private" }],
      ["non-string", { translation: 1 }],
    ];
    for (const [label, translationCredits] of invalidCases) {
      const detail = structuredClone(fixtureV2.document);
      detail.translationCredits = translationCredits;
      globalThis.fetch = async (url) => jsonResponse(
        String(url).endsWith("/index.json") ? structuredClone(fixtureV2.index) : detail,
      );
      const lyrics = await importLyrics();
      await assert.rejects(lyrics.fetchLyricsDocument(detail.musicId), /Invalid lyrics document/, label);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v2 rejects provider-license substitution, unsafe attribution URLs, duplicates, and private fields", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const invalidCases = [
      ["unknown provider", (detail) => { detail.attributions[0].provider = "unknown_provider"; }],
      ["Sekaipedia with Fandom license", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          licenseName: "CC BY-SA 3.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
        });
      }],
      ["Sekaipedia wrong license name", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          licenseName: "CC BY 4.0",
        });
      }],
      ["Sekaipedia with exact Moegirl license", (detail) => {
        detail.attributions[0].licenseName = detail.attributions[1].licenseName;
        detail.attributions[0].licenseUrl = detail.attributions[1].licenseUrl;
      }],
      ["exact Moegirl with Sekaipedia license", (detail) => {
        detail.attributions[1].licenseName = detail.attributions[0].licenseName;
        detail.attributions[1].licenseUrl = detail.attributions[0].licenseUrl;
      }],
      ["Sekaipedia wrong HTTPS license URL", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
        });
      }],
      ["Sekaipedia non-HTTPS license URL", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          licenseUrl: "http://creativecommons.org/licenses/by-sa/4.0/",
        });
      }],
      ["Sekaipedia non-HTTPS revision URL", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          revisionUrl: "http://www.sekaipedia.org/wiki/New_Song?oldid=2468",
        });
      }],
      ["Sekaipedia wrong HTTPS revision host", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          revisionUrl: "https://sekaipedia.example/wiki/New_Song?oldid=2468",
        });
      }],
      ["Sekaipedia wrong revision path", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          revisionUrl: "https://www.sekaipedia.org/index.php?title=New_Song&oldid=2468",
        });
      }],
      ["Sekaipedia revision mismatch", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          revisionUrl: "https://www.sekaipedia.org/wiki/New_Song?oldid=2469",
        });
      }],
      ["Sekaipedia revision URL extra query", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          revisionUrl: "https://www.sekaipedia.org/wiki/New_Song?oldid=2468&diff=prev",
        });
      }],
      ["Sekaipedia revision URL fragment", (detail) => {
        detail.attributions.push({
          ...structuredClone(SEKAIPEDIA_ATTRIBUTION),
          revisionUrl: "https://www.sekaipedia.org/wiki/New_Song?oldid=2468#Lyrics",
        });
      }],
      ["Sekaipedia with exact Moegirl revision URL", (detail) => {
        detail.attributions[0].revisionUrl = MOEGIRL_PUBLIC_EXACT_REVISION_URL;
      }],
      ["exact Moegirl URL with query", (detail) => {
        detail.attributions[1].revisionUrl = `${MOEGIRL_PUBLIC_EXACT_REVISION_URL}?oldid=78`;
      }],
      ["exact Moegirl URL with fragment", (detail) => {
        detail.attributions[1].revisionUrl = `${MOEGIRL_PUBLIC_EXACT_REVISION_URL}#Lyrics`;
      }],
      ["exact Moegirl URL wrong host", (detail) => {
        detail.attributions[1].revisionUrl = "https://moegirl.example/%E4%BA%BF%E5%B9%B4%E7%88%B1%E6%81%8B";
      }],
      ["exact Moegirl URL guessed path", (detail) => {
        detail.attributions[1].revisionUrl = "https://zh.moegirl.org.cn/%E4%BA%BF%E5%B9%B4%E7%88%B1%E6%81%8B-2";
      }],
      ["malformed revision URL", (detail) => { detail.attributions[0].revisionUrl = "https://"; }],
      ["overlong revision URL", (detail) => {
        detail.attributions[0].revisionUrl = `https://vocaloid.fandom.com/wiki/${"a".repeat(2048)}?oldid=34`;
      }],
      ["duplicate attribution", (detail) => {
        detail.attributions.push(structuredClone(detail.attributions[0]));
      }],
      ["duplicate source revision with altered title", (detail) => {
        detail.attributions.push({ ...structuredClone(detail.attributions[0]), title: "Altered duplicate title" });
      }],
      ["privateReview field", (detail) => { detail.privateReview = { approved: true }; }],
      ["revisionTimestamp field", (detail) => {
        detail.attributions[0].revisionTimestamp = "2026-07-31T00:00:00Z";
      }],
      ["romaji field", (detail) => { detail.lines[0].romaji = "Hatsune ga utau"; }],
      ["raw evidence field", (detail) => { detail.attributions[0].rawEvidence = { source: "private" }; }],
      ["raw ruby field", (detail) => { detail.lines[0].segments[0].ruby[0].raw = "private"; }],
      ["internal projection field", (detail) => { detail.gameProjection.internal = { reviewed: true }; }],
    ];

    for (const [label, mutate] of invalidCases) {
      const index = structuredClone(fixtureV2.index);
      const detail = structuredClone(fixtureV2.document);
      mutate(detail);
      let calls = 0;
      globalThis.fetch = async (url) => {
        calls += SINGLE_INCREMENT;
        return jsonResponse(String(url).endsWith("/index.json") ? index : detail);
      };
      const lyrics = await importLyrics();
      await assert.rejects(lyrics.fetchLyricsDocument(detail.musicId), /Invalid lyrics document/, label);
      assert.equal(calls, SINGLE_INCREMENT * 2, `${label} must fail closed without retry`);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v2 cross-field invariants fail closed", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const invalidCases = [
      ["index versions", (index) => { index.songs[0].availableVersions = ["game", "full"]; }],
      ["detail/index version agreement", (_index, detail) => { detail.availableVersions = ["full"]; delete detail.gameProjection; }],
      ["ruby reconstruction", (_index, detail) => { detail.lines[0].segments[0].ruby[0].text = "別"; }],
      ["kana-only ruby", (_index, detail) => { detail.lines[0].segments[0].ruby[0].reading = "hatsune"; }],
      ["segment reconstruction", (_index, detail) => { detail.lines[0].segments[0].text = "初"; detail.lines[0].segments[0].ruby = [{ text: "初" }]; }],
      ["ordered Game references", (_index, detail) => { detail.gameProjection.lineIds = ["line-3", "line-1"]; }],
      ["unique Game references", (_index, detail) => { detail.gameProjection.lineIds = ["line-1", "line-1"]; }],
      ["existing Game references", (_index, detail) => { detail.gameProjection.lineIds = ["line-missing"]; }],
      ["public Game reason", (_index, detail) => { detail.gameProjection.reasonCode = "private_review_reason"; }],
      ["identity Game projection", (_index, detail) => { detail.gameProjection.reasonCode = "untagged_uncut_identity"; detail.gameProjection.lineIds = ["line-1", "line-3"]; }],
      ["closed attribution", (_index, detail) => { detail.attributions[0].sourcePageId = 123; }],
      ["attribution provider", (_index, detail) => { detail.attributions[0].provider = "private_provider"; }],
      ["attribution HTTPS", (_index, detail) => { detail.attributions[0].revisionUrl = "http://example.test/revision/34"; }],
      ["attribution revision", (_index, detail) => { detail.attributions[0].revisionId = "34"; }],
      ["romanization field", (_index, detail) => { detail.romanization = ["Hatsune ga utau"]; }],
      ["private provenance", (_index, detail) => { detail.provenance = { performerSegmentation: { renditionKey: "private-vocaloid-review" } }; }],
    ];

    for (const [label, mutate] of invalidCases) {
      const index = structuredClone(fixtureV2.index);
      const detail = structuredClone(fixtureV2.document);
      mutate(index, detail);
      globalThis.fetch = async (url) => jsonResponse(String(url).endsWith("/index.json") ? index : detail);
      const lyrics = await importLyrics();
      if (label === "index versions") await assert.rejects(lyrics.fetchLyricsIndex(), /Invalid lyrics index/, label);
      else await assert.rejects(lyrics.fetchLyricsDocument(detail.musicId), /Invalid lyrics document/, label);
    }

    const fullOnlyIndex = structuredClone(fixtureV2.index);
    const fullOnlyDetail = structuredClone(fixtureV2.fullOnlyDocument);
    fullOnlyDetail.gameProjection = { reasonCode: "tagged_full_and_game", lineIds: ["line-1"] };
    globalThis.fetch = async (url) => jsonResponse(String(url).endsWith("/index.json") ? fullOnlyIndex : fullOnlyDetail);
    const forbiddenProjection = await importLyrics();
    await assert.rejects(forbiddenProjection.fetchLyricsDocument(fullOnlyDetail.musicId), /Invalid lyrics document/);
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("runtime strict JSON decoding rejects duplicate keys at every public lyrics nesting level", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const indexRaw = JSON.stringify(fixtureV2.index);
    const detailRaw = JSON.stringify(fixtureV2.document);
    const versionToken = `"version":${fixtureV2.index.version}`;
    const musicIdToken = `"musicId":${fixtureV2Publication.musicId}`;
    const titleObjectToken = `"title":${JSON.stringify(fixtureV2Publication.title)}`;
    const titleValue = JSON.stringify(fixtureV2Publication.title["ja-JP"]);
    const titleToken = `"ja-JP":${titleValue}`;
    const japaneseValue = JSON.stringify(fixtureV2.document.lines[0].japanese);
    const japaneseToken = `"japanese":${japaneseValue}`;
    const cases = [
      {
        label: "root version",
        scope: "index",
        body: replaceRawJsonToken(indexRaw, versionToken, `${versionToken},${versionToken}`, "root version"),
      },
      {
        label: "song musicId",
        scope: "index",
        body: replaceRawJsonToken(indexRaw, musicIdToken, `${musicIdToken},${musicIdToken}`, "song musicId"),
      },
      {
        label: "song title",
        scope: "index",
        body: replaceRawJsonToken(indexRaw, titleObjectToken, `${titleObjectToken},${titleObjectToken}`, "song title"),
      },
      {
        label: "escaped-equivalent title locale",
        scope: "index",
        body: replaceRawJsonToken(indexRaw, titleToken, `${titleToken},"\\u006aa-JP":${titleValue}`, "escaped title locale"),
      },
      {
        label: "detail line field",
        scope: "detail",
        body: replaceRawJsonToken(detailRaw, japaneseToken, `${japaneseToken},${japaneseToken}`, "detail line field"),
      },
    ];

    for (const item of cases) {
      let calls = 0;
      globalThis.fetch = async (url) => {
        calls += SINGLE_INCREMENT;
        if (item.scope === "detail" && String(url).endsWith("/index.json")) {
          return jsonResponse(structuredClone(fixtureV2.index));
        }
        return rawJsonResponse(item.body);
      };
      const lyrics = await importLyrics();
      const request = item.scope === "index"
        ? lyrics.fetchLyricsIndex()
        : lyrics.fetchLyricsDocument(fixtureV2.document.musicId);
      await assert.rejects(
        request,
        (error) => error.name === "LyricsLoadError" && error.message === "Invalid lyrics JSON",
        item.label,
      );
      assert.equal(calls, item.scope === "index" ? SINGLE_INCREMENT : SINGLE_INCREMENT * 2, `${item.label} must not retry`);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("runtime strict JSON decoding rejects escaped lone surrogates in titles, lyric text, and attribution", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const indexRaw = JSON.stringify(fixtureV2.index);
    const detailRaw = JSON.stringify(fixtureV2.document);
    const targets = [
      {
        label: "index title",
        scope: "index",
        token: `"ja-JP":${JSON.stringify(fixtureV2Publication.title["ja-JP"])}`,
        key: "ja-JP",
      },
      {
        label: "segment text",
        scope: "detail",
        token: `"text":${JSON.stringify(fixtureV2.document.lines[0].segments[0].text)}`,
        key: "text",
      },
      {
        label: "attribution title",
        scope: "detail",
        token: `"title":${JSON.stringify(fixtureV2.document.attributions[0].title)}`,
        key: "title",
      },
    ];

    for (const target of targets) {
      for (const surrogate of ["D800", "DC00"]) {
        const source = target.scope === "index" ? indexRaw : detailRaw;
        const body = replaceRawJsonToken(
          source,
          target.token,
          `"${target.key}":"\\u${surrogate}"`,
          `${target.label} ${surrogate}`,
        );
        let calls = 0;
        globalThis.fetch = async (url) => {
          calls += SINGLE_INCREMENT;
          if (target.scope === "detail" && String(url).endsWith("/index.json")) {
            return jsonResponse(structuredClone(fixtureV2.index));
          }
          return rawJsonResponse(body);
        };
        const lyrics = await importLyrics();
        const request = target.scope === "index"
          ? lyrics.fetchLyricsIndex()
          : lyrics.fetchLyricsDocument(fixtureV2.document.musicId);
        await assert.rejects(
          request,
          (error) => error.name === "LyricsLoadError"
            && error.message === "Invalid lyrics JSON"
            && !error.message.includes(surrogate),
          `${target.label} ${surrogate}`,
        );
        assert.equal(calls, target.scope === "index" ? SINGLE_INCREMENT : SINGLE_INCREMENT * 2);
      }
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("runtime strict JSON decoding permits valid supplementary Unicode and enforces value depth 64", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const strictJsonUrl = pathToFileURL(path.join(REPO_ROOT, "web/src/lib/strict-json.mjs")).href;
    const { parseStrictJson } = await import(strictJsonUrl);
    for (const codeUnit of [0xD800, 0xDC00]) {
      assert.throws(
        () => parseStrictJson(`{"value":"${String.fromCharCode(codeUnit)}"}`),
        /Invalid JSON/,
      );
    }
    assert.deepEqual(parseStrictJson('{"value":"😀"}'), { value: "😀" });

    const indexRaw = JSON.stringify(fixtureV2.index);
    const detailRaw = JSON.stringify(fixtureV2.document);
    const titleToken = `"ja-JP":${JSON.stringify(fixtureV2Publication.title["ja-JP"])}`;
    for (const [label, encodedTitle] of [
      ["escaped-pair", "\"\\uD83D\\uDE00\""],
      ["utf8-supplementary", JSON.stringify("補足😀")],
    ]) {
      const body = replaceRawJsonToken(indexRaw, titleToken, `"ja-JP":${encodedTitle}`, label);
      globalThis.fetch = async () => rawJsonResponse(body);
      const lyrics = await importLyrics();
      const index = await lyrics.fetchLyricsIndex();
      assert.equal(index.songs[0].title["ja-JP"], label === "escaped-pair" ? "😀" : "補足😀");
    }

    const caseAliasBody = replaceRawJsonToken(
      indexRaw,
      `"version":${fixtureV2.index.version}`,
      `"version":${fixtureV2.index.version},"Version":${fixtureV2.index.version}`,
      "case-alias version",
    );
    globalThis.fetch = async () => rawJsonResponse(caseAliasBody);
    const caseAlias = await importLyrics();
    await assert.rejects(caseAlias.fetchLyricsIndex(), /Invalid lyrics index/);

    for (const scope of ["index", "detail"]) {
      for (const [depth, expected] of [
        [STRICT_JSON_MAX_DEPTH, scope === "index" ? "Invalid lyrics index" : "Invalid lyrics document"],
        [STRICT_JSON_OVERFLOW_DEPTH, "Invalid lyrics JSON"],
      ]) {
        const artifactRaw = scope === "index" ? indexRaw : detailRaw;
        const body = `${artifactRaw.slice(0, -SINGLE_INCREMENT)},"adversarial":${nestedJsonValueAtDepth(depth, JSON_ROOT_MEMBER_DEPTH)}}`;
        let calls = 0;
        globalThis.fetch = async (url) => {
          calls += SINGLE_INCREMENT;
          if (scope === "detail" && String(url).endsWith("/index.json")) {
            return jsonResponse(structuredClone(fixtureV2.index));
          }
          return rawJsonResponse(body);
        };
        const lyrics = await importLyrics();
        const request = scope === "index"
          ? lyrics.fetchLyricsIndex()
          : lyrics.fetchLyricsDocument(fixtureV2.document.musicId);
        await assert.rejects(request, new RegExp(expected), `${scope} depth ${depth}`);
        assert.equal(calls, scope === "index" ? SINGLE_INCREMENT : SINGLE_INCREMENT * 2);
      }
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("runtime strict JSON decoding rejects invalid UTF-8 and trailing JSON without leaking raw content", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const privateMarker = "private-json-marker";
    const cases = [
      ["trailing value", `${JSON.stringify(fixtureV2.index)} {"${privateMarker}":true}`],
      ["UTF-8 BOM", Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(JSON.stringify(fixtureV2.index), "utf8")])],
      ["invalid UTF-8", Uint8Array.from([0x7B, 0x22, 0xFF, 0x22, 0x3A, 0x31, 0x7D])],
    ];
    for (const [label, body] of cases) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += SINGLE_INCREMENT;
        return rawJsonResponse(body);
      };
      const lyrics = await importLyrics();
      await assert.rejects(
        lyrics.fetchLyricsIndex(),
        (error) => error.name === "LyricsLoadError"
          && error.message === "Invalid lyrics JSON"
          && !error.message.includes(privateMarker),
        label,
      );
      assert.equal(calls, SINGLE_INCREMENT, `${label} must fail without retry`);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("detail fetch retries against a changed source instead of returning old-source bytes", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
  };
  const previousFetch = globalThis.fetch;
  const alternateBaseUrl = new URL("alternate", SOURCE_BASE_URL).toString().replace(/\/$/, "");
  let releaseOldDetail;
  const oldDetailGate = new Promise((resolve) => {
    releaseOldDetail = resolve;
  });
  const requests = [];
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
    globalThis.fetch = async (url) => {
      const requestUrl = String(url);
      requests.push(requestUrl);
      if (requestUrl.endsWith("/index.json")) return jsonResponse(structuredClone(fixture.index));
      if (requestUrl.startsWith(SOURCE_BASE_URL)) {
        await oldDetailGate;
        return jsonResponse(structuredClone(fixture.document));
      }
      const alternateDocument = structuredClone(fixture.document);
      alternateDocument.attribution = "Alternate synthetic attribution";
      return jsonResponse(alternateDocument);
    };
    const lyrics = await importLyrics();
    const pending = lyrics.fetchLyricsDocument(fixture.document.musicId);
    await new Promise((resolve) => setImmediate(resolve));
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = alternateBaseUrl;
    releaseOldDetail();

    const document = await pending;
    assert.equal(document.attribution, "Alternate synthetic attribution");
    assert.deepEqual(requests, [
      `${SOURCE_BASE_URL}/index.json`,
      `${SOURCE_BASE_URL}/music_${fixture.document.musicId}.json`,
      `${alternateBaseUrl}/index.json`,
      `${alternateBaseUrl}/music_${fixture.document.musicId}.json`,
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("public lyrics fetches enforce named timeout and artifact byte limits without response.json", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const source = readWeb("src/lib/lyrics.ts");
    assert.match(source, /process\.env\.NEXT_PUBLIC_LYRICS_BASE_URL/);
    assert.match(source, /process\.env\.NEXT_PUBLIC_LYRICS_BASE_URL \|\| DEFAULT_PUBLIC_LYRICS_BASE_URL/);
    assert.doesNotMatch(source, /process\.env\[[^\]]*LYRICS[^\]]*\]/);
    assert.match(source, /const LYRICS_DETAIL_CACHE_LIMIT =/);
    assert.match(source, /const LYRICS_CACHE_TTL_MS =/);
    assert.match(source, /const LYRICS_FETCH_RETRY_LIMIT =/);
    assert.match(source, /const LYRICS_FETCH_RETRY_DELAY_MS =/);
    assert.match(source, /const LYRICS_FETCH_TIMEOUT_MS =/);
    assert.match(source, /const MAX_LYRICS_ARTIFACT_BYTES =/);
    assert.match(source, /parseStrictJson/);
    assert.match(source, /ignoreBOM: true/);
    assert.doesNotMatch(source, /JSON\.parse\(/);
    const strictJsonSource = readWeb("src/lib/strict-json.mjs");
    assert.match(strictJsonSource, /export const MAX_STRICT_JSON_DEPTH = 64;/);
    const timeoutExpression = source.match(/const LYRICS_FETCH_TIMEOUT_MS = ([^;]+);/)?.[1];
    const artifactLimitExpression = source.match(/const MAX_LYRICS_ARTIFACT_BYTES = ([^;]+);/)?.[1];
    assert.ok(timeoutExpression);
    assert.ok(artifactLimitExpression);
    const fetchTimeoutMs = Function(`return (${timeoutExpression})`)();
    const artifactLimitBytes = Function(`return (${artifactLimitExpression})`)();
    assert.doesNotMatch(source, /response\.json\(/);

    globalThis.fetch = async () => new Response(null, {
      status: HTTP_OK,
      headers: { "content-length": String(artifactLimitBytes + OVERSIZED_BYTE_INCREMENT) },
    });
    const oversized = await importLyrics();
    await assert.rejects(oversized.fetchLyricsIndex(), /too large/);

    globalThis.fetch = async () => new Response(new Uint8Array(artifactLimitBytes + OVERSIZED_BYTE_INCREMENT), {
      status: HTTP_OK,
      headers: { "content-type": "application/json" },
    });
    const oversizedStream = await importLyrics();
    await assert.rejects(oversizedStream.fetchLyricsIndex(), /too large/);

    globalThis.fetch = async () => jsonResponse(structuredClone(fixture.index), {
      headers: {
        "content-type": "application/json",
        "content-length": "1",
        "content-encoding": "gzip",
      },
    });
    const decodedLength = await importLyrics();
    assert.deepEqual(await decodedLength.fetchLyricsIndex(), fixture.index);

    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    try {
      globalThis.setTimeout = (callback, delay) => {
        assert.ok(delay === fetchTimeoutMs || delay === 250 || delay === 500);
        queueMicrotask(callback);
        return SINGLE_INCREMENT;
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
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("runtime lyrics fetch retries only sanitized retryable transport and server failures", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  try {
    const source = readWeb("src/lib/lyrics.ts");
    const retryLimitExpression = source.match(/const LYRICS_FETCH_RETRY_LIMIT = ([^;]+);/)?.[1];
    const retryDelayExpression = source.match(/const LYRICS_FETCH_RETRY_DELAY_MS = ([^;]+);/)?.[1];
    assert.ok(retryLimitExpression);
    assert.ok(retryDelayExpression);
    const retryLimit = Function(`return (${retryLimitExpression})`)();
    const retryDelayMs = Function(`return (${retryDelayExpression})`)();
    const totalAttempts = retryLimit + SINGLE_INCREMENT;
    globalThis.setTimeout = (callback, delay) => {
      if (delay <= retryDelayMs * retryLimit) queueMicrotask(callback);
      return SINGLE_INCREMENT;
    };
    globalThis.clearTimeout = () => {};

    let calls = 0;
    globalThis.fetch = async () => {
      calls += SINGLE_INCREMENT;
      if (calls < totalAttempts) return new Response(null, { status: HTTP_SERVICE_UNAVAILABLE });
      return jsonResponse(structuredClone(fixture.index));
    };
    const recovered = await importLyrics();
    assert.deepEqual(await recovered.fetchLyricsIndex(), fixture.index);
    assert.equal(calls, totalAttempts);

    calls = 0;
    globalThis.fetch = async () => {
      calls += SINGLE_INCREMENT;
      return new Response(null, { status: HTTP_NOT_FOUND });
    };
    const notFound = await importLyrics();
    await assert.rejects(notFound.fetchLyricsIndex(), (error) => error.status === HTTP_NOT_FOUND);
    assert.equal(calls, SINGLE_INCREMENT, "404 must fail closed without retry");

    calls = 0;
    globalThis.fetch = async () => {
      calls += SINGLE_INCREMENT;
      return jsonResponse({ version: fixture.index.version, songs: "invalid" });
    };
    const invalid = await importLyrics();
    await assert.rejects(invalid.fetchLyricsIndex(), /Invalid lyrics index/);
    assert.equal(calls, SINGLE_INCREMENT, "schema failures must fail closed without retry");
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("simultaneous lyrics callers share transport while each caller preserves its own abort semantics", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    let releaseFetch;
    const fetchGate = new Promise((resolve) => {
      releaseFetch = resolve;
    });
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += SINGLE_INCREMENT;
      await fetchGate;
      return jsonResponse(structuredClone(fixture.index));
    };
    const lyrics = await importLyrics();
    const controller = new AbortController();
    const abortReason = new Error("caller stopped waiting");

    const aborted = lyrics.fetchLyricsIndex(controller.signal);
    const concurrent = lyrics.fetchLyricsIndex();
    const sharedRequestCount = fetchCount;
    assert.ok(sharedRequestCount > 0, "concurrent callers must start the shared indexRequest");
    controller.abort(abortReason);
    await assert.rejects(aborted, (error) => error === abortReason);

    releaseFetch();
    assert.deepEqual(await concurrent, fixture.index);
    assert.equal(fetchCount, sharedRequestCount, "a caller abort must not cancel or duplicate the shared transport");
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("lyrics publication lookup gates detail routes on the published index", async () => {
  const originalConfig = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 100_000;
  let nextIndex = structuredClone(fixture.index);
  let failure = null;
  let fetchCount = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    fetchCount += SINGLE_INCREMENT;
    if (failure) throw failure;
    return jsonResponse(structuredClone(nextIndex));
  };

  try {
    const lyrics = await importLyrics();
    const lyricsSource = readWeb("src/lib/lyrics.ts");
    const cacheTtlExpression = lyricsSource.match(/const LYRICS_CACHE_TTL_MS = ([^;]+);/)?.[1];
    const retryLimitExpression = lyricsSource.match(/const LYRICS_FETCH_RETRY_LIMIT = ([^;]+);/)?.[1];
    assert.ok(cacheTtlExpression);
    assert.ok(retryLimitExpression);
    const cacheTtlMs = Function(`return (${cacheTtlExpression})`)();
    const retryAttempts = Function(`return (${retryLimitExpression})`)() + SINGLE_INCREMENT;

    assert.deepEqual(await lyrics.getPublishedLyricsIndexEntry(fixture.document.musicId), fixturePublication);
    assert.equal(await lyrics.getPublishedLyricsIndexEntry(Number.MAX_SAFE_INTEGER), null);
    assert.equal(await lyrics.getPublishedLyricsIndexEntry(Number.NaN), null);
    const initialFetchCount = fetchCount;
    assert.ok(initialFetchCount > 0, "publication checks must fetch the index once");

    nextIndex.songs = nextIndex.songs.filter((item) => item.musicId !== fixture.document.musicId);
    let expectedFetchCount = initialFetchCount;
    now += cacheTtlMs + SINGLE_INCREMENT;
    assert.equal(await lyrics.getPublishedLyricsIndexEntry(fixture.document.musicId), null, "unpublication is observed after bounded revalidation");
    expectedFetchCount += SINGLE_INCREMENT;
    assert.equal(fetchCount, expectedFetchCount);

    nextIndex = structuredClone(fixture.index);
    now += cacheTtlMs + SINGLE_INCREMENT;
    assert.deepEqual(await lyrics.getPublishedLyricsIndexEntry(fixture.document.musicId), fixturePublication, "publication is observed without a process restart");
    expectedFetchCount += SINGLE_INCREMENT;
    assert.equal(fetchCount, expectedFetchCount);

    now += cacheTtlMs + SINGLE_INCREMENT;
    failure = new Error("temporary index failure at private-host.internal");
    assert.deepEqual(
      await lyrics.getPublishedLyricsIndexEntry(fixture.document.musicId),
      fixturePublication,
      "a transient refresh failure returns the last validated publication instead of a false 404",
    );
    failure = null;
    expectedFetchCount += retryAttempts;
    assert.deepEqual(await lyrics.getPublishedLyricsIndexEntry(fixture.document.musicId), fixturePublication, "an expired LKG remains retryable without extending its TTL");
    expectedFetchCount += SINGLE_INCREMENT;
    assert.equal(fetchCount, expectedFetchCount);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = previousFetch;
    if (originalConfig === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = originalConfig;
  }

  const page = readWeb("src/app/lyrics/[musicId]/page.tsx");
  const layout = readWeb("src/app/lyrics/[musicId]/layout.tsx");
  assert.match(page, /fetchLyricsDocument/);
  assert.match(page, /isLyricsUnavailableError/);
  assert.match(layout, /createDetailFallbackMetadata\("lyrics"/);
  assert.match(page, /canonicalMusicId === null \|\| !await hasAvailableLyrics\(canonicalMusicId\)/);
  assert.match(page, /\^\[1-9\]\\d\*\$/);
});

test("lyrics detail SEO and page require an available detail while preserving upstream failures", async () => {
  const notFoundError = new Error("NEXT_NOT_FOUND");
  const state = {
    document: fixture.document,
    error: { status: HTTP_NOT_FOUND },
    notFoundError,
    notFoundStatus: HTTP_NOT_FOUND,
    calls: [],
  };
  globalThis.__lyricsDetailSeoTest = state;

  try {
    const layout = await importLyricsDetailLayout();
    const page = await importLyricsDetailPage();
    const unavailableMusicId = Number.MAX_SAFE_INTEGER;

    assert.deepEqual(await layout.generateMetadata({ params: Promise.resolve({ musicId: String(unavailableMusicId) }) }), {
      kind: "fallback-metadata",
      args: ["lyrics", `/lyrics/${unavailableMusicId}`, "summary"],
    });
    assert.deepEqual(state.calls, [
      ["document", unavailableMusicId],
      ["fallbackMetadata", "lyrics", `/lyrics/${unavailableMusicId}`, "summary"],
    ]);
    state.calls.length = 0;

    await assert.rejects(
      page.default({ params: Promise.resolve({ musicId: String(unavailableMusicId) }) }),
      (error) => error === notFoundError,
    );
    assert.deepEqual(state.calls, [
      ["document", unavailableMusicId],
      ["notFound"],
    ]);

    state.error = null;
    state.calls.length = 0;
    assert.deepEqual(await layout.generateMetadata({ params: Promise.resolve({ musicId: String(fixture.document.musicId) }) }), {
      kind: "published-metadata",
      resolvedParams: { id: String(fixture.document.musicId) },
    });
    assert.deepEqual(await page.default({ params: Promise.resolve({ musicId: String(fixture.document.musicId) }) }), "published-detail-page");
    assert.deepEqual(state.calls, [
      ["document", fixture.document.musicId],
      ["detailMetadata", { id: String(fixture.document.musicId) }],
      ["document", fixture.document.musicId],
      ["detailPage", { id: String(fixture.document.musicId) }],
    ]);

    for (const alias of ["010", "1e1", "+10", "0", "-1", String(Number.MAX_SAFE_INTEGER + SINGLE_INCREMENT)]) {
      state.calls.length = 0;
      assert.deepEqual(await layout.generateMetadata({ params: Promise.resolve({ musicId: alias }) }), {
        kind: "fallback-metadata",
        args: ["lyrics", `/lyrics/${alias}`, "summary"],
      });
      assert.deepEqual(state.calls, [["fallbackMetadata", "lyrics", `/lyrics/${alias}`, "summary"]], alias);
      state.calls.length = 0;
      await assert.rejects(
        page.default({ params: Promise.resolve({ musicId: alias }) }),
        (error) => error === notFoundError,
      );
      assert.deepEqual(state.calls, [["notFound"]], alias);
    }

    state.error = { status: HTTP_SERVICE_UNAVAILABLE, message: "upstream unavailable" };
    state.calls.length = 0;
    await assert.rejects(
      layout.generateMetadata({ params: Promise.resolve({ musicId: String(fixture.document.musicId) }) }),
      (error) => error === state.error,
    );
    await assert.rejects(
      page.default({ params: Promise.resolve({ musicId: String(fixture.document.musicId) }) }),
      (error) => error === state.error,
    );
    assert.deepEqual(state.calls, [["document", fixture.document.musicId], ["document", fixture.document.musicId]]);

    state.error = new Error("malformed lyrics payload");
    state.calls.length = 0;
    await assert.rejects(
      layout.generateMetadata({ params: Promise.resolve({ musicId: String(fixture.document.musicId) }) }),
      (error) => error === state.error,
    );
    await assert.rejects(
      page.default({ params: Promise.resolve({ musicId: String(fixture.document.musicId) }) }),
      (error) => error === state.error,
    );
    assert.deepEqual(state.calls, [["document", fixture.document.musicId], ["document", fixture.document.musicId]]);
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
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => String(url).endsWith("/index.json")
      ? jsonResponse(structuredClone(fixture.index))
      : new Response(null, { status: HTTP_NOT_FOUND });
    const missing = await importLyrics();
    await assert.rejects(missing.fetchLyricsDocument(fixture.document.musicId), (error) => missing.isLyricsUnavailableError(error));

    globalThis.fetch = async (url) => String(url).endsWith("/index.json")
      ? jsonResponse(structuredClone(fixture.index))
      : new Response(null, { status: HTTP_SERVICE_UNAVAILABLE });
    const unavailable = await importLyrics();
    await assert.rejects(
      unavailable.fetchLyricsDocument(fixture.document.musicId),
      (error) => error.name === "LyricsLoadError" && error.status === HTTP_SERVICE_UNAVAILABLE && !unavailable.isLyricsUnavailableError(error),
    );

    const privateNetworkError = "getaddrinfo ENOTFOUND private-host.internal";
    const secretLikeDetail = "token=secret-value";
    globalThis.fetch = async () => { throw new Error(`${privateNetworkError} ${secretLikeDetail}`); };
    const sanitizedNetwork = await importLyrics();
    await assert.rejects(
      sanitizedNetwork.fetchLyricsIndex(),
      (error) => error.name === "LyricsLoadError"
        && error.message === "Lyrics artifact request failed"
        && !error.message.includes(privateNetworkError)
        && !error.message.includes(secretLikeDetail),
    );

    globalThis.fetch = async () => jsonResponse({ version: fixture.index.version, songs: "invalid" });
    const malformed = await importLyrics();
    await assert.rejects(malformed.fetchLyricsIndex(), /Invalid lyrics index/);

    const duplicateLineDocument = structuredClone(fixture.document);
    duplicateLineDocument.lines.push(structuredClone(duplicateLineDocument.lines[0]));
    globalThis.fetch = async (url) => jsonResponse(String(url).endsWith("/index.json") ? structuredClone(fixture.index) : duplicateLineDocument);
    const duplicateLines = await importLyrics();
    await assert.rejects(duplicateLines.fetchLyricsDocument(fixture.document.musicId), /Invalid lyrics document/);

    const sparseOrderDocument = structuredClone(fixture.document);
    sparseOrderDocument.lines[0].order = fixture.document.lines[0].order + SINGLE_INCREMENT;
    sparseOrderDocument.lines[0].segments[0].text = "";
    globalThis.fetch = async (url) => jsonResponse(String(url).endsWith("/index.json") ? structuredClone(fixture.index) : sparseOrderDocument);
    const sparseOrder = await importLyrics();
    assert.equal((await sparseOrder.fetchLyricsDocument(fixture.document.musicId)).lines[0].order, sparseOrderDocument.lines[0].order);

    const privateFieldDocument = structuredClone(fixture.document);
    privateFieldDocument.sourceUrl = new URL("source", SOURCE_BASE_URL).toString();
    globalThis.fetch = async (url) => jsonResponse(String(url).endsWith("/index.json") ? structuredClone(fixture.index) : privateFieldDocument);
    const privateFields = await importLyrics();
    await assert.rejects(privateFields.fetchLyricsDocument(fixture.document.musicId), /Invalid lyrics document/);
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("lyrics detail client renders the canonical committed fixture successfully", async () => {
  try {
    const lyrics = await importLyrics();
    const rendered = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = fixture.document.musicId;
      state.document = structuredClone(fixture.document);
      state.musics = [{
        id: fixture.document.musicId,
        title: fixturePublication.title["en-US"] ?? fixturePublication.title["ja-JP"],
        lyricist: fixture.document.attribution,
        assetbundleName: fixturePublication.title["ja-JP"],
      }];
    });
    const expectedEnglishTitle = fixturePublication.title["en-US"] ?? fixturePublication.title["ja-JP"];
    assert.match(rendered.text, new RegExp(expectedEnglishTitle));
    assert.match(rendered.text, new RegExp(fixture.document.attribution));
    assert.match(rendered.text, new RegExp(fixture.document.lines[0].japanese));
    assert.match(rendered.text, new RegExp(fixture.document.lines[0]["en-US"]));
    assert.match(rendered.html, /md:grid-cols-2/);
    assert.doesNotMatch(rendered.text, /page\.lyrics\.(?:error|notFound)/);
  } finally {
    delete globalThis.__lyricsClientRuntimeTest;
  }
});

test("lyrics detail client preserves authoritative Virtual Singer and shared-singer segments without rendition metadata", async () => {
  try {
    const lyrics = await importLyrics();
    const virtualSingerDocument = structuredClone(fixtureV2.document);
    for (const line of virtualSingerDocument.lines) {
      for (const segment of line.segments) {
        segment.performerIds = segment.performerIds.map((performerId) => performerId === 1 ? 21 : 22);
      }
    }
    const rendered = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = virtualSingerDocument.musicId;
      state.document = virtualSingerDocument;
      state.musics = [{
        id: virtualSingerDocument.musicId,
        title: fixtureV2Publication.title["en-US"],
        assetbundleName: fixtureV2Publication.title["ja-JP"],
        categories: [],
      }];
    });
    const dom = new JSDOM(rendered.html);
    const renderedSegments = [...dom.window.document.querySelectorAll("[data-lyric-performers]")];
    const performerAssignments = renderedSegments.map((segment) => segment.getAttribute("data-lyric-performers"));
    assert.ok(performerAssignments.includes("21"), "a Virtual Singer assignment reaches the boxed lyric component");
    assert.ok(performerAssignments.includes("21,22"), "a shared Virtual Singer assignment remains one multi-singer segment");
    const sharedSegment = renderedSegments.find((segment) => segment.getAttribute("data-lyric-performers") === "21,22");
    assert.equal(sharedSegment?.textContent, virtualSingerDocument.lines[1].segments[0].text);
    assert.match(sharedSegment?.getAttribute("data-lyric-ruby") ?? "", /未来:みらい/);
    assert.doesNotMatch(rendered.html, /renditionKey|performerSegmentation|private-vocaloid-review/i);
    dom.window.close();
  } finally {
    delete globalThis.__lyricsClientRuntimeTest;
  }
});

test("lyrics detail client defaults to Full and honors a shareable Game projection query", async () => {
  try {
    const lyrics = await importLyrics();
    const full = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = fixtureV2.document.musicId;
      state.document = structuredClone(fixtureV2.document);
      state.musics = [{
        id: fixtureV2.document.musicId,
        title: fixtureV2Publication.title["en-US"],
        assetbundleName: fixtureV2Publication.title["ja-JP"],
        categories: [],
      }];
    });
    assert.match(full.text, new RegExp(fixtureV2.document.lines[1].japanese));
    assert.match(full.text, /page\.lyrics\.versionFull/);
    assert.match(full.text, /page\.lyrics\.versionGame/);
    assert.match(full.text, new RegExp(String(fixtureV2.document.attributions[0].revisionId)));

    const game = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = fixtureV2.document.musicId;
      state.search = "version=game";
      state.document = structuredClone(fixtureV2.document);
      state.musics = [{
        id: fixtureV2.document.musicId,
        title: fixtureV2Publication.title["en-US"],
        assetbundleName: fixtureV2Publication.title["ja-JP"],
        categories: [],
      }];
    });
    assert.match(game.text, new RegExp(fixtureV2.document.lines[0].japanese));
    assert.match(game.text, new RegExp(fixtureV2.document.lines[2].japanese));
    assert.doesNotMatch(game.text, new RegExp(fixtureV2.document.lines[1].japanese));

    const switchedToGame = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = fixtureV2.document.musicId;
      state.search = "keep=yes";
      state.document = structuredClone(fixtureV2.document);
      state.musics = [{ id: fixtureV2.document.musicId, title: "New Song", assetbundleName: "new-song", categories: [] }];
    }, ({ container, window }) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "page.lyrics.versionGame");
      assert.ok(button);
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(switchedToGame.state.replacedSearch, "keep=yes&version=game");

    const switchedToFull = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = fixtureV2.document.musicId;
      state.search = "keep=yes&version=game";
      state.document = structuredClone(fixtureV2.document);
      state.musics = [{ id: fixtureV2.document.musicId, title: "New Song", assetbundleName: "new-song", categories: [] }];
    }, ({ container, window }) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "page.lyrics.versionFull");
      assert.ok(button);
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    assert.equal(switchedToFull.state.replacedSearch, "keep=yes");

    const fullOnly = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = fixtureV2.fullOnlyDocument.musicId;
      state.search = "keep=yes&version=game";
      state.document = structuredClone(fixtureV2.fullOnlyDocument);
      state.musics = [{ id: fixtureV2.fullOnlyDocument.musicId, title: "Long Song", assetbundleName: "long-song", categories: [] }];
    });
    assert.equal(fullOnly.state.replacedSearch, "keep=yes");
    assert.doesNotMatch(fullOnly.text, /page\.lyrics\.versionGame/);
    assert.match(fullOnly.text, /page\.lyrics\.translationCreditsEmpty|page\.lyrics\.translationFallback/);

    const gameOnly = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = fixtureV2.gameOnlyDocument.musicId;
      state.document = structuredClone(fixtureV2.gameOnlyDocument);
      state.musics = [{ id: fixtureV2.gameOnlyDocument.musicId, title: "Game Version Only", assetbundleName: "game-only", categories: [] }];
    });
    assert.match(gameOnly.text, /page\.lyrics\.versionGame/);
    assert.doesNotMatch(gameOnly.text, /page\.lyrics\.versionFull/);
    assert.match(gameOnly.text, new RegExp(fixtureV2.gameOnlyDocument.lines[0].japanese));
    const gameOnlyDom = new JSDOM(gameOnly.html);
    assert.equal(gameOnlyDom.window.document.querySelector("[data-lyric-trailing-performers]")?.getAttribute("data-lyric-trailing-performers"), "1,2");
    gameOnlyDom.window.close();
  } finally {
    delete globalThis.__lyricsClientRuntimeTest;
  }
});

test("Public Lyrics v3 keeps peer renditions separate and preserves an independent Game-only family", async () => {
  const lyrics = await importLyrics();
  const publication = {
    musicId: fixtureV3.musicId,
    revision: fixtureV3.revision,
    updatedAt: fixtureV3.updatedAt,
    title: { "ja-JP": "新曲", "zh-CN": "新曲", "en-US": "New Song" },
    state: "complete",
    availableVersions: ["full", "game"],
  };
  const music = { id: fixtureV3.musicId, title: "New Song", assetbundleName: "new-song", categories: [] };

  const sekai = await renderLyricsClientRuntime(lyrics, (state) => {
    state.musicId = fixtureV3.musicId;
    state.publication = structuredClone(publication);
    state.document = structuredClone(fixtureV3);
    state.musics = [music];
  });
  assert.match(sekai.text, /SEKAI/);
  assert.match(sekai.text, /VIRTUAL SINGER/);
  assert.match(sekai.text, /page\.lyrics\.versionFull/);
  assert.match(sekai.text, /page\.lyrics\.versionGame/);
  assert.match(sekai.text, /page\.lyrics\.translationAndProofreading/);

  const virtualSinger = await renderLyricsClientRuntime(lyrics, (state) => {
    state.musicId = fixtureV3.musicId;
    state.search = "rendition=virtual-singer&version=full";
    state.publication = structuredClone(publication);
    state.document = structuredClone(fixtureV3);
    state.musics = [music];
  });
  assert.match(virtualSinger.text, /VIRTUAL/);
  assert.match(virtualSinger.text, /独立译者/);
  assert.match(virtualSinger.text, /page\.lyrics\.versionGame/);
  assert.doesNotMatch(virtualSinger.text, /page\.lyrics\.versionFull/);
  assert.equal(virtualSinger.state.replacedSearch, "rendition=virtual-singer");
  assert.match(virtualSinger.text, new RegExp(String(SEKAIPEDIA_ATTRIBUTION.revisionId)));

  const switched = await renderLyricsClientRuntime(lyrics, (state) => {
    state.musicId = fixtureV3.musicId;
    state.search = "keep=yes&rendition=sekai";
    state.publication = structuredClone(publication);
    state.document = structuredClone(fixtureV3);
    state.musics = [music];
  }, ({ container, window }) => {
    const button = [...container.querySelectorAll("button")].find((item) => item.textContent === "VIRTUAL SINGER");
    assert.ok(button);
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  assert.equal(switched.state.replacedSearch, "keep=yes&rendition=virtual-singer");
});

test("Public Lyrics v3 accepts a top-level Game-only detail without fabricating Full", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  try {
    const detail = structuredClone(fixtureV3);
    detail.musicId += SINGLE_INCREMENT;
    detail.state = "game_only";
    detail.renditions = [structuredClone(fixtureV3.renditions[1])];
    const index = v3IndexForDetail(detail);
    globalThis.fetch = async (url) => jsonResponse(
      String(url).endsWith("/index.json") ? structuredClone(index) : structuredClone(detail),
    );

    const lyrics = await importLyrics();
    const document = await lyrics.fetchLyricsDocument(detail.musicId);
    assert.equal(document.state, "game_only");
    assert.deepEqual(lyrics.getLyricsAvailableVersions(document), ["game"]);
    assert.equal(document.renditions.length, 1);
    assert.equal("full" in document.renditions[0], false);
    assert.ok(document.renditions[0].game);

    const rendered = await renderLyricsClientRuntime(lyrics, (state) => {
      state.musicId = detail.musicId;
      state.publication = structuredClone(index.songs[0]);
      state.document = structuredClone(detail);
      state.musics = [{ id: detail.musicId, title: "Game-only Song", assetbundleName: "game-only", categories: [] }];
    });
    assert.match(rendered.text, /page\.lyrics\.versionGame/);
    assert.doesNotMatch(rendered.text, /page\.lyrics\.versionFull/);
    assert.match(rendered.text, /VIRTUAL/);
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v3 rejects unknown fields at document, rendition, and line levels", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  try {
    const cases = [
      ["document", (detail) => { detail.privateUnknown = true; }],
      ["rendition", (detail) => { detail.renditions[0].privateUnknown = true; }],
      ["line", (detail) => { detail.renditions[0].game.lines[0].privateUnknown = true; }],
    ];
    for (const [label, mutate] of cases) {
      const detail = structuredClone(fixtureV3);
      mutate(detail);
      const index = v3IndexForDetail(detail);
      globalThis.fetch = async (url) => String(url).endsWith("/index.json")
        ? jsonResponse(index)
        : rawJsonResponse(JSON.stringify(detail));
      const lyrics = await importLyrics();
      await assert.rejects(lyrics.fetchLyricsDocument(detail.musicId), /Invalid lyrics document/, label);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v3 preserves source-exact ASCII and ideographic edge whitespace", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  try {
    const exactJapanese = "  SEKAI\u3000";
    const detail = structuredClone(fixtureV3);
    const fullLine = detail.renditions[0].full.lines[0];
    const gameLine = detail.renditions[0].game.lines[0];
    for (const line of [fullLine, gameLine]) {
      line.japanese = exactJapanese;
      line.segments[0].text = exactJapanese;
      line.segments[0].ruby = [{ text: exactJapanese }];
    }
    const publication = {
      musicId: detail.musicId,
      revision: detail.revision,
      updatedAt: detail.updatedAt,
      title: { "ja-JP": "新曲", "zh-CN": "新曲", "en-US": "New Song" },
      state: "complete",
      availableVersions: ["full", "game"],
    };
    globalThis.fetch = async (url) => jsonResponse(
      String(url).endsWith("/index.json")
        ? { version: 3, songs: [publication] }
        : detail,
    );

    const lyrics = await importLyrics();
    const document = await lyrics.fetchLyricsDocument(detail.musicId);
    assert.equal(document.renditions[0].full.lines[0].japanese, exactJapanese);
    assert.equal(document.renditions[0].full.lines[0].segments[0].text, exactJapanese);
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v3 exact projections preserve independent Game IDs and source facts", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  try {
    const detail = strictV3ProjectionFixture();
    const sourceGameLine = detail.renditions[0].game.lines[0];
    sourceGameLine.segments = [
      { text: "歌", performerIds: [], ruby: [{ text: "歌", reading: "うた" }] },
      { text: "う", performerIds: ["miku"], ruby: [{ text: "う" }] },
    ];
    sourceGameLine.trailingPerformerIds = [];
    delete sourceGameLine.stanzaBreakBefore;
    const index = v3IndexForDetail(detail);
    globalThis.fetch = async (url) => jsonResponse(
      String(url).endsWith("/index.json") ? structuredClone(index) : structuredClone(detail),
    );

    const lyrics = await importLyrics();
    const document = await lyrics.fetchLyricsDocument(detail.musicId);
    const rendition = document.renditions[0];
    const fullLine = rendition.full.lines[1];
    const gameLine = rendition.game.lines[0];
    assert.notEqual(gameLine.id, fullLine.id, "Game keeps its own canonical line ID");
    assert.equal(gameLine.order, 0);
    assert.equal(fullLine.order, 1);
    assert.deepEqual(rendition.relation.lineIds, [fullLine.id]);
    assert.deepEqual(lyrics.getLyricsDisplayLines(document, "game", rendition.key).map((line) => line.id), [gameLine.id]);
    assert.equal(lyrics.getLyricsDisplayLines(document, "game", rendition.key)[0], gameLine);
    assert.notEqual(lyrics.getLyricsDisplayLines(document, "game", rendition.key)[0], fullLine);
    assert.equal(gameLine["zh-CN"], fullLine["zh-CN"], "exact-projection localization is canonicalized from Full");
    assert.notDeepEqual(gameLine.segments, fullLine.segments, "Game source segmentation, performers, and ruby remain independently owned");
    assert.notEqual(Boolean(gameLine.stanzaBreakBefore), Boolean(fullLine.stanzaBreakBefore));
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v3 exact projections reject relation/text/localization drift but accept independent Game source facts", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  try {
    const invalidCases = [
      ["relation mapping", (detail) => { detail.renditions[0].relation.lineIds = ["full-1"]; }],
      ["source text", (detail) => {
        const line = detail.renditions[0].game.lines[0];
        line.japanese = "読む";
        line.segments = [{ text: "読む", performerIds: ["miku"], ruby: [{ text: "読", reading: "よ" }, { text: "む" }] }];
      }],
      ["Chinese localization", (detail) => { detail.renditions[0].game.lines[0]["zh-CN"] = "独立游戏译文"; }],
      ["English localization", (detail) => { detail.renditions[0].game.lines[0]["en-US"] = "Independent Game translation"; }],
    ];

    for (const [label, mutate] of invalidCases) {
      const detail = strictV3ProjectionFixture();
      mutate(detail);
      const index = v3IndexForDetail(detail);
      globalThis.fetch = async (url) => jsonResponse(
        String(url).endsWith("/index.json") ? structuredClone(index) : structuredClone(detail),
      );
      const lyrics = await importLyrics();
      await assert.rejects(lyrics.fetchLyricsDocument(detail.musicId), /Invalid lyrics document/, label);
    }

    const independentSourceFactCases = [
      ["segment boundaries", (detail) => {
        detail.renditions[0].game.lines[0].segments = [
          { text: "歌", performerIds: ["miku"], ruby: [{ text: "歌", reading: "うた" }] },
          { text: "う", performerIds: ["miku"], ruby: [{ text: "う" }] },
        ];
      }],
      ["ruby reading", (detail) => { detail.renditions[0].game.lines[0].segments[0].ruby[0].reading = "か"; }],
      ["segment performers", (detail) => { detail.renditions[0].game.lines[0].segments[0].performerIds = []; }],
      ["trailing performers", (detail) => { detail.renditions[0].game.lines[0].trailingPerformerIds = []; }],
      ["stanza boundary", (detail) => { delete detail.renditions[0].game.lines[0].stanzaBreakBefore; }],
    ];
    for (const [label, mutate] of independentSourceFactCases) {
      const detail = strictV3ProjectionFixture();
      mutate(detail);
      const index = v3IndexForDetail(detail);
      globalThis.fetch = async (url) => jsonResponse(
        String(url).endsWith("/index.json") ? structuredClone(index) : structuredClone(detail),
      );
      const lyrics = await importLyrics();
      const document = await lyrics.fetchLyricsDocument(detail.musicId);
      assert.equal(document.renditions[0].game.lines[0].id, "game-1", label);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("Public Lyrics v3 ruby requires kana readings only on nonnumeric Han bases and forbids romanization", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  try {
    const detailForRuby = (text, ruby) => {
      const detail = strictV3ProjectionFixture();
      const rendition = detail.renditions[0];
      delete rendition.game;
      rendition.availableVersions = ["full"];
      rendition.relation = { kind: "none" };
      rendition.full.lines = [{
        id: "full-ruby",
        order: 0,
        japanese: text,
        "zh-CN": "译文",
        "en-US": "Translation",
        segments: [{ text, performerIds: ["miku"], ruby }],
        trailingPerformerIds: [],
      }];
      return detail;
    };
    const fetchDetail = async (detail) => {
      const index = v3IndexForDetail(detail);
      globalThis.fetch = async (url) => jsonResponse(
        String(url).endsWith("/index.json") ? structuredClone(index) : structuredClone(detail),
      );
      const lyrics = await importLyrics();
      return lyrics.fetchLyricsDocument(detail.musicId);
    };

    for (const [label, text, ruby] of [
      ["Han with kana", "歌", [{ text: "歌", reading: "うた" }]],
      ["plain kana", "かな", [{ text: "かな" }]],
      ["ideographic zero", "〇", [{ text: "〇" }]],
    ]) {
      const document = await fetchDetail(detailForRuby(text, ruby));
      assert.equal(document.renditions[0].full.lines[0].japanese, text, label);
    }

    const invalidCases = [
      ["Han without reading", "歌", [{ text: "歌" }], null],
      ["reading on kana", "かな", [{ text: "かな", reading: "かな" }], null],
      ["reading on ideographic zero", "〇", [{ text: "〇", reading: "れい" }], null],
      ["romanized reading", "歌", [{ text: "歌", reading: "uta" }], null],
      ["reading without kana", "歌", [{ text: "歌", reading: "ー" }], null],
      ["mixed Han and kana base", "歌う", [{ text: "歌う", reading: "うたう" }], null],
      ["romanization field", "歌", [{ text: "歌", reading: "うた" }], (detail) => {
        detail.renditions[0].full.lines[0].romaji = "uta";
      }],
    ];
    for (const [label, text, ruby, mutate] of invalidCases) {
      const detail = detailForRuby(text, ruby);
      mutate?.(detail);
      await assert.rejects(fetchDetail(detail), /Invalid lyrics document/, label);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("lyrics credits merge identical values, split distinct values, localize empty credits, and order Sekaipedia source/license metadata", async () => {
  const labels = creditsPresentationFixture.labels["en-US"];
  const translations = {
    "page.lyrics.attribution": labels.heading,
    "page.lyrics.translation": labels.translation,
    "page.lyrics.proofreading": labels.proofreading,
    "page.lyrics.translationAndProofreading": labels.translationAndProofreading,
    "page.lyrics.translationCreditsEmpty": labels.empty,
    "page.lyrics.sourceLicenseTitle": labels.sourceLicenseTitle,
    "page.lyrics.sourceRevision": labels.sourceRevision,
    "page.lyrics.sourceLicense": labels.sourceLicense,
    "page.lyrics.attributionProviders.sekaipedia": labels.sekaipedia,
  };

  const lyrics = await importLyrics();
  const renderCredits = async (translationCredits) => renderLyricsClientRuntime(lyrics, (state) => {
    const document = structuredClone(fixtureV2.document);
    if (translationCredits === null) delete document.translationCredits;
    else document.translationCredits = structuredClone(translationCredits);
    state.musicId = document.musicId;
    state.document = document;
    state.translations = translations;
    state.musics = [{
      id: document.musicId,
      title: fixtureV2Publication.title["en-US"],
      assetbundleName: fixtureV2Publication.title["ja-JP"],
      categories: [],
    }];
  });

  const same = await renderCredits(creditsPresentationFixture.same);
  const sameDom = new JSDOM(same.html);
  const sameTerms = [...sameDom.window.document.querySelectorAll("dt")].map((item) => item.textContent?.trim());
  const sameValues = [...sameDom.window.document.querySelectorAll("dd")].map((item) => item.textContent?.trim());
  assert.equal(sameTerms.filter((value) => value === labels.translationAndProofreading).length, 1);
  assert.equal(sameTerms.filter((value) => value === labels.translation).length, 0);
  assert.equal(sameTerms.filter((value) => value === labels.proofreading).length, 0);
  assert.equal(sameValues.filter((value) => value === creditsPresentationFixture.same.translation).length, 1);
  const creditsHeading = [...sameDom.window.document.querySelectorAll("h2")]
    .find((item) => item.textContent?.trim() === labels.heading);
  const sourceHeading = [...sameDom.window.document.querySelectorAll("h3")]
    .find((item) => item.textContent?.trim() === labels.sourceLicenseTitle);
  assert.ok(creditsHeading, "the credits card heading is localized as Translation credits");
  assert.ok(sourceHeading, "the source/license heading is rendered below credits");
  assert.ok(
    creditsHeading.compareDocumentPosition(sourceHeading) & sameDom.window.Node.DOCUMENT_POSITION_FOLLOWING,
    "source/license metadata follows the translation credits content",
  );

  const sekaipediaAttribution = fixtureV2.document.attributions.find((item) => item.provider === "sekaipedia");
  assert.ok(sekaipediaAttribution);
  const sekaipediaRow = [...sameDom.window.document.querySelectorAll("li")]
    .find((item) => item.textContent?.includes(labels.sekaipedia));
  assert.ok(sekaipediaRow);
  assert.deepEqual(
    [...sekaipediaRow.querySelectorAll("dt")].map((item) => item.textContent?.trim()),
    [labels.sourceRevision, labels.sourceLicense],
  );
  assert.deepEqual(
    [...sekaipediaRow.querySelectorAll("dd")].map((item) => item.textContent?.trim()),
    [String(sekaipediaAttribution.revisionId), "CC BY-SA 4.0"],
  );
  assert.deepEqual(
    [...sekaipediaRow.querySelectorAll("a")].map((item) => item.getAttribute("href")),
    [sekaipediaAttribution.revisionUrl, "https://creativecommons.org/licenses/by-sa/4.0/"],
  );
  sameDom.window.close();

  const v3 = await renderLyricsClientRuntime(lyrics, (state) => {
    const document = structuredClone(fixtureV3);
    state.musicId = document.musicId;
    state.document = document;
    state.publication = v3IndexForDetail(document).songs[0];
    state.translations = translations;
    state.musics = [{
      id: document.musicId,
      title: "New Song",
      assetbundleName: "new_song",
      categories: [],
    }];
  });
  const v3Dom = new JSDOM(v3.html);
  const v3SourceHeading = [...v3Dom.window.document.querySelectorAll("h3")]
    .find((item) => item.textContent?.trim() === labels.sourceLicenseTitle);
  const v3SourceList = v3SourceHeading?.parentElement?.nextElementSibling;
  assert.equal(v3SourceList?.querySelectorAll("li").length, 1,
    "v3 provenance components collapse into one visible source card per source identity");
  v3Dom.window.close();

  assert.match(readWeb("src/app/lyrics/[musicId]/client.tsx"), /getLyricsDisplayAttributions/);

  const distinct = await renderCredits(creditsPresentationFixture.distinct);
  const distinctDom = new JSDOM(distinct.html);
  const distinctTerms = [...distinctDom.window.document.querySelectorAll("dt")].map((item) => item.textContent?.trim());
  const distinctValues = [...distinctDom.window.document.querySelectorAll("dd")].map((item) => item.textContent?.trim());
  assert.equal(distinctTerms.filter((value) => value === labels.translation).length, 1);
  assert.equal(distinctTerms.filter((value) => value === labels.proofreading).length, 1);
  assert.equal(distinctTerms.filter((value) => value === labels.translationAndProofreading).length, 0);
  assert.ok(distinctValues.includes(creditsPresentationFixture.distinct.translation));
  assert.ok(distinctValues.includes(creditsPresentationFixture.distinct.proofreading));
  distinctDom.window.close();

  const empty = await renderCredits(creditsPresentationFixture.empty);
  const emptyDom = new JSDOM(empty.html);
  assert.ok([...emptyDom.window.document.querySelectorAll("p")]
    .some((item) => item.textContent?.trim() === labels.empty));
  assert.doesNotMatch(empty.text, new RegExp(creditsPresentationFixture.same.translation));
  emptyDom.window.close();

  assert.match(
    readWeb("src/lib/i18n/messages/zh-CN/index.ts"),
    new RegExp(`translationAndProofreading: "${creditsPresentationFixture.labels["zh-CN"].translationAndProofreading}"`),
  );
  assert.match(readWeb("src/app/lyrics/[musicId]/client.tsx"), /translationCredits\?\.translation\?\.trim\(\)/);
});

test("lyrics detail client localizes 404 races and separates upstream failures without leaking errors", async () => {
  try {
    const lyrics = await importLyrics();
    const unavailableMessage = "private unavailable artifact location";
    const unavailableText = await renderLyricsClientFailure(
      lyrics,
      new lyrics.LyricsLoadError(unavailableMessage, HTTP_NOT_FOUND),
    );
    assert.match(unavailableText, /page\.lyrics\.notFound/);
    assert.doesNotMatch(unavailableText, /page\.lyrics\.error/);
    assert.doesNotMatch(unavailableText, new RegExp(unavailableMessage));

    const failureMessage = "private upstream response";
    const failedText = await renderLyricsClientFailure(
      lyrics,
      new lyrics.LyricsLoadError(failureMessage, HTTP_SERVICE_UNAVAILABLE),
    );
    assert.match(failedText, /page\.lyrics\.error/);
    assert.doesNotMatch(failedText, /page\.lyrics\.notFound/);
    assert.doesNotMatch(failedText, new RegExp(failureMessage));
  } finally {
    delete globalThis.__lyricsClientRuntimeTest;
  }
});

test("lyrics detail cache evicts the least recently used document at its named bound", async () => {
  const original = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  try {
    const source = readWeb("src/lib/lyrics.ts");
    const cacheLimitExpression = source.match(/const LYRICS_DETAIL_CACHE_LIMIT = ([^;]+);/)?.[1];
    assert.ok(cacheLimitExpression);
    const cacheLimit = Function(`return (${cacheLimitExpression})`)();
    const musicIds = Array.from(
      { length: cacheLimit + SINGLE_INCREMENT },
      (_, index) => index + SINGLE_INCREMENT,
    );
    let fetchCount = 0;
    globalThis.fetch = async (url) => {
      fetchCount += SINGLE_INCREMENT;
      if (String(url).endsWith("/index.json")) {
        const publication = fixturePublication;
        return jsonResponse({
          version: fixture.index.version,
          songs: musicIds.map((musicId) => ({
            ...structuredClone(publication),
            musicId,
          })),
        });
      }
      const musicId = Number(new URL(String(url)).pathname.match(/\/music_(\d+)\.json$/)?.[1]);
      const document = structuredClone(fixture.document);
      document.musicId = musicId;
      return jsonResponse(document);
    };
    const lyrics = await importLyrics();

    for (const musicId of musicIds) {
      await lyrics.fetchLyricsDocument(musicId);
    }
    const indexFetchCount = SINGLE_INCREMENT;
    assert.equal(fetchCount, musicIds.length + indexFetchCount);
    const newestMusicId = musicIds[musicIds.length - SINGLE_INCREMENT];
    assert.ok(newestMusicId);
    await lyrics.fetchLyricsDocument(newestMusicId);
    assert.equal(fetchCount, musicIds.length + indexFetchCount, "the newest detail remains cached");
    await lyrics.fetchLyricsDocument(musicIds[0]);
    assert.equal(fetchCount, musicIds.length + indexFetchCount + SINGLE_INCREMENT, "the oldest detail is fetched again after eviction");
  } finally {
    globalThis.fetch = previousFetch;
    if (original === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = original;
  }
});

test("lyrics detail cache is revision-keyed, TTL-bounded, and rejects unsynchronized detail bytes", async () => {
  const originalConfig = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 100_000;
  let revision = fixture.document.revision;
  let detailRevision = fixture.document.revision;
  let indexFetches = 0;
  let detailFetches = 0;
  Date.now = () => now;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/index.json")) {
      indexFetches += SINGLE_INCREMENT;
      const index = structuredClone(fixture.index);
      index.songs[0].revision = revision;
      return jsonResponse(index);
    }
    detailFetches += SINGLE_INCREMENT;
    const document = structuredClone(fixture.document);
    document.revision = detailRevision;
    return jsonResponse(document);
  };

  try {
    const lyrics = await importLyrics();
    const cacheTtlExpression = readWeb("src/lib/lyrics.ts").match(/const LYRICS_CACHE_TTL_MS = ([^;]+);/)?.[1];
    assert.ok(cacheTtlExpression);
    const cacheTtlMs = Function(`return (${cacheTtlExpression})`)();

    assert.equal((await lyrics.fetchLyricsDocument(fixture.document.musicId)).revision, fixture.document.revision);
    const initialIndexFetches = indexFetches;
    const initialDetailFetches = detailFetches;
    now += cacheTtlMs - SINGLE_INCREMENT;
    assert.equal((await lyrics.fetchLyricsDocument(fixture.document.musicId)).revision, fixture.document.revision);
    assert.equal(detailFetches, initialDetailFetches);

    now += 2;
    assert.equal((await lyrics.fetchLyricsDocument(fixture.document.musicId)).revision, fixture.document.revision);
    assert.equal(indexFetches, initialIndexFetches + SINGLE_INCREMENT);
    assert.equal(detailFetches, initialDetailFetches + SINGLE_INCREMENT, "same-revision details revalidate after the TTL");

    now += cacheTtlMs + SINGLE_INCREMENT;
    revision += SINGLE_INCREMENT;
    await assert.rejects(lyrics.fetchLyricsDocument(fixture.document.musicId), /Invalid lyrics document/);
    detailRevision = revision;
    assert.equal((await lyrics.fetchLyricsDocument(fixture.document.musicId)).revision, revision);
    const revisionChangeFetches = SINGLE_INCREMENT * 3;
    assert.equal(detailFetches, initialDetailFetches + revisionChangeFetches, "revision mismatch is not cached and remains retryable");
  } finally {
    Date.now = originalNow;
    globalThis.fetch = previousFetch;
    if (originalConfig === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = originalConfig;
  }
});

test("expired lyrics detail refreshes fall back to the exact last validated revision without extending its TTL", async () => {
  const originalConfig = process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
  process.env.NEXT_PUBLIC_LYRICS_BASE_URL = SOURCE_BASE_URL;
  const previousFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 100_000;
  let failDetail = false;
  let detailFetches = 0;
  Date.now = () => now;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/index.json")) return jsonResponse(structuredClone(fixture.index));
    detailFetches += SINGLE_INCREMENT;
    if (failDetail) throw new Error("temporary detail failure at private-host.internal");
    return jsonResponse(structuredClone(fixture.document));
  };

  try {
    const lyrics = await importLyrics();
    const lyricsSource = readWeb("src/lib/lyrics.ts");
    const cacheTtlExpression = lyricsSource.match(/const LYRICS_CACHE_TTL_MS = ([^;]+);/)?.[1];
    const retryLimitExpression = lyricsSource.match(/const LYRICS_FETCH_RETRY_LIMIT = ([^;]+);/)?.[1];
    assert.ok(cacheTtlExpression);
    assert.ok(retryLimitExpression);
    const cacheTtlMs = Function(`return (${cacheTtlExpression})`)();
    const retryAttempts = Function(`return (${retryLimitExpression})`)() + SINGLE_INCREMENT;

    assert.deepEqual(await lyrics.fetchLyricsDocument(fixture.document.musicId), fixture.document);
    const initialDetailFetches = detailFetches;
    now += cacheTtlMs + SINGLE_INCREMENT;
    failDetail = true;
    assert.deepEqual(
      await lyrics.fetchLyricsDocument(fixture.document.musicId),
      fixture.document,
      "the exact published revision keeps serving its last validated detail during a transient refresh failure",
    );
    assert.equal(detailFetches, initialDetailFetches + retryAttempts);

    failDetail = false;
    assert.deepEqual(await lyrics.fetchLyricsDocument(fixture.document.musicId), fixture.document);
    assert.equal(detailFetches, initialDetailFetches + retryAttempts + SINGLE_INCREMENT, "the stale fallback remains expired and retries on the next call");

    now += cacheTtlMs + SINGLE_INCREMENT;
    globalThis.fetch = async (url) => String(url).endsWith("/index.json")
      ? jsonResponse(structuredClone(fixture.index))
      : jsonResponse({ ...structuredClone(fixture.document), lines: "invalid" });
    await assert.rejects(
      lyrics.fetchLyricsDocument(fixture.document.musicId),
      /Invalid lyrics document/,
      "malformed replacement bytes must fail closed instead of using LKG",
    );
  } finally {
    Date.now = originalNow;
    globalThis.fetch = previousFetch;
    if (originalConfig === undefined) delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    else process.env.NEXT_PUBLIC_LYRICS_BASE_URL = originalConfig;
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
  const colors = await importWebTypeScript("src/lib/lyrics-colors.ts", [
    [
      'import { getExternalLyricsPerformer } from "@/lib/lyrics-performers";',
      "const getExternalLyricsPerformer = () => null;",
    ],
    [
      'import { CHAR_COLORS } from "@/types/types";',
      `const CHAR_COLORS = ${JSON.stringify(baseline.charColors)};`,
    ],
  ]);
  for (const [characterId, color] of Object.entries(baseline.charColors)) {
    const adjusted = colors.getLyricsPerformerColors(Number(characterId));
    assert.equal(adjusted.base, color);
    assert.ok(colors.contrastRatio(adjusted.light, "#ffffff") >= 4.5, `${color} light contrast`);
    assert.ok(colors.contrastRatio(adjusted.dark, "#0f172a") >= 4.5, `${color} dark contrast`);
    assert.ok(colors.contrastRatio(adjusted.light, "#f1f5f9") >= 3, `${color} light marker contrast`);
    assert.ok(colors.contrastRatio(adjusted.dark, "#1e293b") >= 3, `${color} dark marker contrast`);
  }
  assert.equal(colors.getLyricsPerformerColors(Number.MAX_SAFE_INTEGER), null);
});

test("lyric segments keep solid and gradient colors with deduplicated line-end avatar groups", async () => {
  const source = readWeb("src/components/lyrics/LyricText.tsx");
  const lyricsSource = readWeb("src/lib/lyrics.ts");
  const clientSource = readWeb("src/app/lyrics/[musicId]/client.tsx");
  const colorSource = readWeb("src/lib/lyrics-colors.ts");
  const performerSource = readWeb("src/lib/lyrics-performers.ts");
  assert.match(colorSource, /import \{ CHAR_COLORS \} from "@\/types\/types";/);
  assert.match(colorSource, /getExternalLyricsPerformer/);
  assert.match(colorSource, /CHAR_COLORS\[String\(characterId\)\] \?\?/);
  assert.doesNotMatch(colorSource, /Record<.*string.*string>|"1":\s*"#/);
  assert.match(source, /getLyricsPerformerColors/);
  assert.match(source, /getCharacterName\(t, id, "short"\)/);
  assert.match(source, /linePerformerGroups/);
  assert.match(source, /samePerformerGroup/);
  assert.match(source, /linear-gradient\(90deg/);
  assert.match(source, /bg-clip-text text-transparent/);
  assert.match(source, /text-\[var\(--performer-light\)\]/);
  assert.match(source, /dark:text-\[var\(--performer-dark\)\]/);
  assert.match(source, /aria-label=\{names\}/);
  assert.match(source, /rounded-full border-2/);
  assert.match(source, /-space-x-1\.5/);
  assert.match(source, /ms-2 inline-flex max-w-full flex-wrap/);
  assert.doesNotMatch(source, /title=|className="sr-only"|rounded-xl border border-slate-200\/80/,
    "performer names must remain nonvisual and the old boxed tooltip UI must stay removed");
  assert.match(source, /min-w-0 max-w-full/);
  assert.match(source, /flex-wrap/);
  assert.doesNotMatch(source, /whitespace-nowrap|overflow-x-auto/);
  assert.match(source, /<ruby/);
  assert.match(source, /<rt/);
  assert.match(source, /<rp>/);
  assert.match(source, /span\.reading/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.match(source, /\[overflow-wrap:anywhere\]/);
  assert.match(clientSource, /<LyricText[\s\S]*segments=\{getLyricsDisplaySegments\(line\)\}[\s\S]*trailingPerformerIds=/);
  assert.deepEqual(fixtureV2.fullOnlyDocument.lines[0].segments[0].performerIds, []);
  assert.deepEqual(fixture.vocaloidOnlyDocument.lines[0].segments[0].performerIds, []);
  assert.doesNotMatch(`${source}\n${lyricsSource}\n${clientSource}`, /\b(?:romaji|romanized|romanization)\b/i);

  const performers = await importWebTypeScript("src/lib/lyrics-performers.ts");
  assert.deepEqual(performers.EXTERNAL_LYRICS_PERFORMERS.map((item) => item.id), [1001, 1002, 1003, 1004, 1006, 1007, 1008, 1009, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019]);
  assert.equal(new Set(performers.EXTERNAL_LYRICS_PERFORMERS.map((item) => item.sourceId)).size, 17);
  assert.equal(performers.getExternalLyricsPerformerBySourceId("外部歌唱者-03")?.name, "flower");
  assert.equal(performers.getExternalLyricsPerformerBySourceId("外部歌唱者-13")?.name, "Adachi Rei");
  assert.equal(performers.getExternalLyricsPerformer(1004)?.avatarUrl, undefined);
  assert.equal(performers.getExternalLyricsPerformer(1004)?.name, "Nenerobo");
  assert.equal(performers.getLyricsCharacterIdBySourceId("歌唱者-19"), 19);
  assert.equal(performers.getLyricsCharacterIdBySourceId("歌唱者-25"), 25);
  assert.equal(performers.getLyricsCharacterIdBySourceId("外部歌唱者-01"), null);
  assert.doesNotMatch(performerSource, /placeholder|initial|letter/i);
  for (const legacyIllustration of [
    "gumi.svg",
    "kafu.svg",
    "sekai.svg",
    "zundamon.svg",
    "kotonoha-aoi.svg",
    "kotonoha-akane.svg",
  ]) {
    assert.equal(
      fs.existsSync(path.join(REPO_ROOT, "web/public/images/lyrics-performers", legacyIllustration)),
      false,
      `${legacyIllustration} must not remain available as a reusable self-drawn avatar source`,
    );
  }
  for (const performer of performers.EXTERNAL_LYRICS_PERFORMERS) {
    assert.equal(performers.getExternalLyricsPerformer(performer.id), performer);
    if (performer.avatarUrl) {
      const assetPath = path.join(REPO_ROOT, "web/public", performer.avatarUrl.replace(/^\//, ""));
      assert.ok(fs.statSync(assetPath).size > 1000, `${performer.name} must have a real local avatar asset`);
    }
  }

  globalThis.__lyricTextRuntimeTest = {
    React,
    colors: new Map([
      [19, { base: "#CCAA88", light: "#745A42", dark: "#E7C5A3" }],
      [21, { base: "#33CCBB", light: "#17786F", dark: "#5EE6D5" }],
      [22, { base: "#FFCC11", light: "#7A5F00", dark: "#FFE066" }],
      [25, { base: "#DD4444", light: "#8A2020", dark: "#FF8585" }],
      [1001, { base: "#70B85A", light: "#34712A", dark: "#93DF7A" }],
      [1002, { base: "#D83B67", light: "#7B1734", dark: "#F58BA8" }],
    ]),
    external: new Map([
      [1001, { id: 1001, sourceId: "外部歌唱者-01", name: "GUMI", color: "#70B85A", avatarUrl: "/images/lyrics-performers/gumi.webp" }],
      [1002, { id: 1002, sourceId: "外部歌唱者-02", name: "Kasane Teto", color: "#D83B67", avatarUrl: "/images/lyrics-performers/teto.webp" }],
      [1003, { id: 1003, sourceId: "外部歌唱者-03", name: "flower", color: "#7B6A84", avatarUrl: "/images/lyrics-performers/flower.webp" }],
      [1006, { id: 1006, sourceId: "外部歌唱者-06", name: "Kamui Gakupo", color: "#6F73C8", avatarUrl: "/images/lyrics-performers/gakupo.webp" }],
      [1007, { id: 1007, sourceId: "外部歌唱者-07", name: "KAFU", color: "#8A8A91", avatarUrl: "/images/lyrics-performers/kafu.webp" }],
      [1008, { id: 1008, sourceId: "外部歌唱者-08", name: "Gekiyaku", color: "#A66D87", avatarUrl: "/images/lyrics-performers/gekiyaku.webp" }],
      [1009, { id: 1009, sourceId: "外部歌唱者-09", name: "SEKAI", color: "#4A89A8", avatarUrl: "/images/lyrics-performers/sekai.webp" }],
      [1011, { id: 1011, sourceId: "外部歌唱者-11", name: "Zundamon", color: "#78AF54", avatarUrl: "/images/lyrics-performers/zundamon.webp" }],
      [1012, { id: 1012, sourceId: "外部歌唱者-12", name: "Kaai Yuki", color: "#4F5A4B", avatarUrl: "/images/lyrics-performers/yuki.webp" }],
      [1013, { id: 1013, sourceId: "外部歌唱者-13", name: "Adachi Rei", color: "#E56E1B", avatarUrl: "/images/lyrics-performers/adachi-rei.webp" }],
      [1014, { id: 1014, sourceId: "外部歌唱者-14", name: "RIME", color: "#563E8E", avatarUrl: "/images/lyrics-performers/rime.webp" }],
      [1015, { id: 1015, sourceId: "外部歌唱者-15", name: "Hanakuma Chifuyu", color: "#506D87", avatarUrl: "/images/lyrics-performers/chifuyu.webp" }],
      [1016, { id: 1016, sourceId: "外部歌唱者-16", name: "VY1", color: "#31A1B5", avatarUrl: "/images/lyrics-performers/vy1.webp" }],
      [1017, { id: 1017, sourceId: "外部歌唱者-17", name: "SOLARIA", color: "#B86D46", avatarUrl: "/images/lyrics-performers/solaria.webp" }],
      [1018, { id: 1018, sourceId: "外部歌唱者-18", name: "Kotonoha Aoi", color: "#4D8FCC", avatarUrl: "/images/lyrics-performers/kotonoha-aoi.webp" }],
      [1019, { id: 1019, sourceId: "外部歌唱者-19", name: "Kotonoha Akane", color: "#D75C58", avatarUrl: "/images/lyrics-performers/kotonoha-akane.webp" }],
    ]),
  };
  try {
    const LyricText = await importLyricText();
    const fallbackSegment = fixtureV2.fullOnlyDocument.lines[0].segments[0];
    const fallbackHtml = renderToString(React.createElement(LyricText, {
      text: fallbackSegment.text,
      performerIds: fallbackSegment.performerIds,
      ruby: fallbackSegment.ruby,
    }));
    assert.match(fallbackHtml, /長/);
    assert.match(fallbackHtml, /<ruby/);
    assert.doesNotMatch(fallbackHtml, /<img|aria-label=|title=/,
      "an unsegmented fallback must remain one clean lyric line without an empty avatar group");

    const virtualSingerSegment = fixtureV2.document.lines[0].segments[0];
    const virtualSingerHtml = renderToString(React.createElement(LyricText, {
      text: virtualSingerSegment.text,
      performerIds: [21],
      ruby: virtualSingerSegment.ruby,
    }));
    assert.match(virtualSingerHtml, /--performer-light/);
    assert.match(virtualSingerHtml, /aria-label="character-21"/);
    assert.match(virtualSingerHtml, /src="\/character-21\.webp"/);
    assert.match(virtualSingerHtml, /rounded-full/);
    assert.doesNotMatch(virtualSingerHtml, /title=/);

    const sharedSegment = fixtureV2.document.lines[1].segments[0];
    const sharedHtml = renderToString(React.createElement(LyricText, {
      segments: [{ text: sharedSegment.text, performerIds: [21, 22], ruby: sharedSegment.ruby }],
    }));
    const sharedDom = new JSDOM(sharedHtml);
    const line = sharedDom.window.document.querySelector("p");
    assert.ok(line?.classList.contains("min-w-0"));
    assert.ok(line?.classList.contains("max-w-full"));
    assert.match(sharedHtml, /linear-gradient\(90deg/);
    assert.equal(sharedDom.window.document.querySelectorAll("[aria-label='character-21, character-22'] img").length, 2);
    assert.ok(sharedDom.window.document.querySelector("[aria-label='character-21, character-22']")?.classList.contains("-space-x-1.5"));
    assert.doesNotMatch(sharedHtml, /title=/);
    sharedDom.window.close();

    const wholeLineHtml = renderToString(React.createElement(LyricText, {
      segments: [{ text: "整行", performerIds: [], ruby: [{ text: "整行" }] }],
      trailingPerformerIds: [21, 22],
    }));
    const wholeLineDom = new JSDOM(wholeLineHtml);
    assert.doesNotMatch(wholeLineHtml, /--performer-|linear-gradient\(90deg/,
      "whole-line attribution must not be flattened into a colored singer segment");
    assert.equal(wholeLineDom.window.document.querySelectorAll("[aria-label='character-21, character-22'] img").length, 2);
    assert.ok(wholeLineDom.window.document.querySelector("[aria-label='character-21, character-22']")?.classList.contains("-space-x-1.5"));
    assert.doesNotMatch(wholeLineHtml, /title=/);
    wholeLineDom.window.close();

    const groupedHtml = renderToString(React.createElement(LyricText, {
      segments: [
        { text: "一", performerIds: [21], ruby: [{ text: "一" }] },
        { text: "二", performerIds: [21], ruby: [{ text: "二" }] },
        { text: "三", performerIds: [21, 22], ruby: [{ text: "三" }] },
      ],
    }));
    const groupedDom = new JSDOM(groupedHtml);
    assert.equal(groupedDom.window.document.querySelectorAll("[aria-label]").length, 2,
      "adjacent identical singer groups are represented by one line-end avatar group");
    assert.equal(groupedDom.window.document.querySelectorAll("img").length, 3);
    assert.equal(groupedDom.window.document.querySelector("p")?.textContent, "一二三",
      "aria-only performer names must not become visible lyric text");
    groupedDom.window.close();

    const v3CharacterHtml = renderToString(React.createElement(LyricText, {
      text: "歌唱", performerIds: ["歌唱者-21"], ruby: [{ text: "歌唱" }],
      performers: [{ performerId: "歌唱者-21", name: "初音ミク" }],
    }));
    assert.match(v3CharacterHtml, /--performer-light/);
    assert.match(v3CharacterHtml, /aria-label="初音ミク"/);
    assert.match(v3CharacterHtml, /src="\/character-21\.webp"/);
    assert.doesNotMatch(v3CharacterHtml, />初音ミク</,
      "v3 character names remain accessible labels instead of visible fallback pills");

    const v3MixedCharacterHtml = renderToString(React.createElement(LyricText, {
      text: "東雲 MEIKO", performerIds: ["歌唱者-19", "歌唱者-25"],
      ruby: [{ text: "東雲 MEIKO" }],
      performers: [
        { performerId: "歌唱者-19", name: "東雲絵名" },
        { performerId: "歌唱者-25", name: "MEIKO" },
      ],
    }));
    assert.match(v3MixedCharacterHtml, /linear-gradient\(90deg/);
    assert.match(v3MixedCharacterHtml, /aria-label="東雲絵名, MEIKO"/);
    assert.equal((v3MixedCharacterHtml.match(/src="\/character-(?:19|25)\.webp"/g) ?? []).length, 2);

    const externalHtml = renderToString(React.createElement(LyricText, {
      text: "外部歌唱", performerIds: [1001], ruby: [{ text: "外部歌唱" }],
    }));
    assert.match(externalHtml, /aria-label="GUMI"/);
    assert.match(externalHtml, /\/images\/lyrics-performers\/gumi\.webp/);
    assert.doesNotMatch(externalHtml, /title=/);

    const v3ExternalHtml = renderToString(React.createElement(LyricText, {
      text: "外部歌唱", performerIds: ["外部歌唱者-01"], ruby: [{ text: "外部歌唱" }],
      performers: [{ performerId: "外部歌唱者-01", name: "GUMI" }],
    }));
    assert.match(v3ExternalHtml, /--performer-light/);
    assert.match(v3ExternalHtml, /aria-label="GUMI"/);
    assert.match(v3ExternalHtml, /\/images\/lyrics-performers\/gumi\.webp/);

    const tetoHtml = renderToString(React.createElement(LyricText, {
      text: "重音テト", performerIds: [1002], ruby: [{ text: "重音テト" }],
    }));
    assert.match(tetoHtml, /aria-label="Kasane Teto"/);
    assert.match(tetoHtml, /\/images\/lyrics-performers\/teto\.webp/);

    const v3TetoHtml = renderToString(React.createElement(LyricText, {
      text: "重音テト", performerIds: ["外部歌唱者-02"], ruby: [{ text: "重音テト" }],
      performers: [{ performerId: "外部歌唱者-02", name: "Kasane Teto" }],
    }));
    assert.match(v3TetoHtml, /aria-label="Kasane Teto"/);
    assert.match(v3TetoHtml, /\/images\/lyrics-performers\/teto\.webp/);

    const v3MissingSetHtml = renderToString(React.createElement(LyricText, {
      text: "外部合唱", performerIds: ["外部歌唱者-03", "外部歌唱者-13", "外部歌唱者-14", "外部歌唱者-15"], ruby: [{ text: "外部合唱" }],
      performers: [
        { performerId: "外部歌唱者-03", name: "flower" },
        { performerId: "外部歌唱者-13", name: "Adachi Rei" },
        { performerId: "外部歌唱者-14", name: "RIME" },
        { performerId: "外部歌唱者-15", name: "Hanakuma Chifuyu" },
      ],
    }));
    assert.match(v3MissingSetHtml, /aria-label="flower, Adachi Rei, RIME, Hanakuma Chifuyu"/);
    assert.match(v3MissingSetHtml, /\/images\/lyrics-performers\/flower\.webp/);
    assert.match(v3MissingSetHtml, /\/images\/lyrics-performers\/adachi-rei\.webp/);
    assert.match(v3MissingSetHtml, /\/images\/lyrics-performers\/rime\.webp/);
    assert.match(v3MissingSetHtml, /\/images\/lyrics-performers\/chifuyu\.webp/);
    assert.doesNotMatch(v3MissingSetHtml, />fl<|>Ad<|>RI<|>Ha</);
  } finally {
    delete globalThis.__lyricTextRuntimeTest;
  }

  assert.doesNotMatch(`${source}\n${lyricsSource}`, /\b701\b/, "lyrics consumer must not hard-code a stale catalog size");
});

test("lyrics list and detail retain loading, empty, error, long-line, mobile, and dark contracts", () => {
  const list = readWeb("src/app/lyrics/client.tsx");
  const detail = readWeb("src/app/lyrics/[musicId]/client.tsx");
  const musicItem = readWeb("src/components/music/MusicItem.tsx");
  const layout = readWeb("src/components/music/music-layout.ts");

  assert.match(list, /fetchLyricsIndex\(\)/);
  assert.match(list, /<MusicFilters/);
  assert.match(list, /useQuickFilter\(/);
  assert.match(list, /lg:max-h-\[calc\(100vh-6rem\)\]/);
  assert.match(list, /data-shortcut-load-more="true"/);
  assert.doesNotMatch(list, /<main className="min-w-0 flex-1"/);
  assert.match(list, /<MusicItem/);
  assert.match(list, /hrefBase="\/lyrics"/);
  assert.match(list, /hasLyricsDetail\(lyrics\)/);
  assert.match(list, /getLyricsAvailableVersions\(lyrics\)/);
  assert.match(list, /page\.lyrics\.versionFullAndGame/);
  assert.match(list, /page\.lyrics\.versionFull/);
  assert.match(list, /loading-spinner|animate-pulse/);
  assert.match(list, /page\.lyrics\.empty/);
  assert.match(list, /role="alert"/);
  assert.match(detail, /useBreadcrumb\(\)/);
  assert.match(detail, /setDetailName\(music\.title\)/);
  assert.match(detail, /divide-y divide-slate-100/);
  assert.match(detail, /grid grid-cols-1/);
  assert.match(detail, /md:grid-cols-2/);
  assert.match(detail, /dark:border-slate-700/);
  assert.match(detail, /translated \|\| line\.japanese/);
  assert.match(detail, /<LyricText[\s\S]*segments=\{getLyricsDisplaySegments\(line\)\}[\s\S]*trailingPerformerIds=/);
  assert.doesNotMatch(detail, /getLyricsDisplaySegments\(line\)\.map/,
    "the source column must render one complete line so avatars appear only at the whole-line end");
  assert.match(detail, /<LyricText/);
  assert.match(detail, /<LyricText text=\{targetText\} performerIds=\{\[\]\} \/>/);
  assert.match(detail, /useSearchParams\(\)/);
  assert.match(detail, /query\.set\("version", "game"\)/);
  assert.match(detail, /query\.delete\("version"\)/);
  assert.match(detail, /getLyricsDisplayLines\(lyrics, activeVersion(?:, [^)]+)?\)/);
  assert.match(detail, /lyrics\.attribution/);
  assert.match(detail, /attributions\.map/);
  assert.match(detail, /<ExternalLink/);
  assert.match(detail, /page\.lyrics\.translationFallback/);
  assert.match(detail, /page\.lyrics\.attribution/);
  assert.doesNotMatch(detail, /romaji|romanized|romanization/i);
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
    result[entry.status] = (result[entry.status] ?? 0) + SINGLE_INCREMENT;
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
