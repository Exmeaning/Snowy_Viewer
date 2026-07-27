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
const fixture = {
  index: readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json"),
  document: readJson("tests/fixtures/next-public-lyrics-v1/detail.fixture.json"),
};
const fixturePublication = fixture.index.songs.find((song) => song.musicId === fixture.document.musicId);
assert.ok(fixturePublication, "canonical detail fixture must be published by the canonical index fixture");

function jsonResponse(value, overrides = {}) {
  const body = JSON.stringify(value);
  return new Response(body, {
    status: HTTP_OK,
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
    },
    ...overrides,
  });
}

async function importLyrics() {
  return importWebTypeScript("src/lib/lyrics.ts");
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
  lyricsClientModuleSequence += SINGLE_INCREMENT;
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

  const state = { error: null, document: null, musics: [], musicId: fixture.document.musicId };
  const translate = (key) => key;
  globalThis.__lyricsClientRuntimeTest = {
    React,
    Image: ({ fill: _fill, unoptimized: _unoptimized, ...props }) => React.createElement("img", props),
    useParams: () => ({ musicId: String(state.musicId) }),
    MainLayout: ({ children }) => React.createElement("main", null, children),
    LyricText: ({ text }) => React.createElement("span", null, text),
    Link: ({ children, ...props }) => React.createElement("a", props, children),
    useI18n: function useI18n() {
      return { locale: "en-US", t: translate };
    },
    useTheme: () => ({ assetSource: "main" }),
    fetchMasterData: async () => state.musics,
    fetchLyricsDocument: async () => {
      if (state.error) throw state.error;
      return state.document;
    },
    getLyricsTargetLocale: lyrics.getLyricsTargetLocale,
    isLyricsUnavailableError: lyrics.isLyricsUnavailableError,
    getMusicJacketUrl: () => "/jacket.webp",
  };
  return { Client: (await import(`data:text/javascript;base64,${encoded}`)).default, state };
}

async function renderLyricsClientRuntime(lyrics, configure) {
  const { Client, state } = await importLyricsDetailClient(lyrics);
  configure(state);
  const element = React.createElement(Client);
  const serverHtml = renderToString(element);
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${serverHtml}</div></body></html>`, {
    url: new URL(`/en-us/lyrics/${state.musicId}/`, SOURCE_BASE_URL).toString(),
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
    return { text: container.textContent, html: container.innerHTML };
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
    assert.throws(
      () => lyrics.getLyricsBaseUrl(),
      /Lyrics base URL is not configured/,
      "missing config must not silently select another source",
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
    assert.doesNotMatch(source, /process\.env\[[^\]]*LYRICS[^\]]*\]/);
    assert.match(source, /const LYRICS_DETAIL_CACHE_LIMIT =/);
    assert.match(source, /const LYRICS_CACHE_TTL_MS =/);
    assert.match(source, /const LYRICS_FETCH_RETRY_LIMIT =/);
    assert.match(source, /const LYRICS_FETCH_RETRY_DELAY_MS =/);
    assert.match(source, /const LYRICS_FETCH_TIMEOUT_MS =/);
    assert.match(source, /const MAX_LYRICS_ARTIFACT_BYTES =/);
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
  assert.match(page, /if \(!await hasAvailableLyrics\(Number\(musicId\)\)\) notFound\(\)/);
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
  assert.equal(colors.getLyricsPerformerColors(Number.MAX_SAFE_INTEGER), null);
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
  assert.ok(fixture.document.lines[0].segments[0].performerIds.length > 0);
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
