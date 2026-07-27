import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  importTypeScriptSource,
  importWebTypeScript,
  readJson,
  readWeb,
  WEB_ROOT,
} from "./test-helpers.mjs";

const PUBLIC_LYRICS_BASE_URL = "https://lyrics.example.test/public";
const LOOPBACK_LYRICS_BASE_URLS = [
  "http://127.0.0.1/public",
  "http://localhost/public",
  "http://[::1]/public",
];
const SITEMAP_TEST_ORIGIN = "https://sitemap.example.test";
const HTTP_OK = 200;
const TEST_FETCH_TIMEOUT_MS = 1000;
const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
const MAX_TCP_PORT = 65_535;
const LOOPBACK_TEST_PORTS = [DEFAULT_HTTP_PORT, DEFAULT_HTTPS_PORT, MAX_TCP_PORT].map(String);
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const ATTEMPT_INCREMENT = 1;
const OVERSIZED_BYTE_INCREMENT = ATTEMPT_INCREMENT;

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

let publicLyricsModuleSequence = 0;

function importPublicLyrics(label) {
  publicLyricsModuleSequence += ATTEMPT_INCREMENT;
  const moduleUrl = pathToFileURL(path.join(WEB_ROOT, "scripts/lib/public-lyrics.mjs"));
  return import(`${moduleUrl.href}?test=${publicLyricsModuleSequence}-${label}`);
}

test("build-time lyrics index follows the same required credential-free source as the client", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
  };
  try {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = `${PUBLIC_LYRICS_BASE_URL}/`;
    let lyrics = await importPublicLyrics("https");
    assert.equal(lyrics.getConfiguredPublicLyricsIndexUrl(), `${PUBLIC_LYRICS_BASE_URL}/index.json`);

    for (const configured of LOOPBACK_LYRICS_BASE_URLS) {
      process.env.NEXT_PUBLIC_LYRICS_BASE_URL = configured;
      lyrics = await importPublicLyrics(encodeURIComponent(configured));
      const configuredUrl = new URL(configured);
      configuredUrl.pathname = configuredUrl.pathname.replace(/\/+$/, "");
      const normalizedBaseUrl = configuredUrl.toString().replace(/\/$/, "");
      assert.equal(lyrics.getConfiguredPublicLyricsIndexUrl(), `${normalizedBaseUrl}/index.json`);
    }
    for (const port of LOOPBACK_TEST_PORTS) {
      const configured = new URL(LOOPBACK_LYRICS_BASE_URLS[0]);
      configured.port = port;
      process.env.NEXT_PUBLIC_LYRICS_BASE_URL = configured.toString();
      lyrics = await importPublicLyrics(`port-${port}`);
      const normalizedBaseUrl = configured.toString().replace(/\/$/, "");
      assert.equal(lyrics.getConfiguredPublicLyricsIndexUrl(), `${normalizedBaseUrl}/index.json`);
    }

    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = LOOPBACK_LYRICS_BASE_URLS[0];
    lyrics = await importPublicLyrics("production-loopback");
    assert.throws(
      () => lyrics.getConfiguredPublicLyricsIndexUrl(),
      /Invalid NEXT_PUBLIC_LYRICS_BASE_URL/,
      "production builds reject plaintext loopback sources",
    );

    for (const unsafe of [
      "http://example.test/public",
      "http://backend/public",
      "https://user:password@example.test/public",
      "https://example.test/public?token=secret",
      `${PUBLIC_LYRICS_BASE_URL}?`,
      `${PUBLIC_LYRICS_BASE_URL}#`,
      `${PUBLIC_LYRICS_BASE_URL}?#`,
      "https://example.test/",
      ` ${PUBLIC_LYRICS_BASE_URL}`,
      "http://127.999.0.1/public",
      "not-a-url",
    ]) {
      process.env.NEXT_PUBLIC_LYRICS_BASE_URL = unsafe;
      const lyrics = await importPublicLyrics(encodeURIComponent(unsafe));
      assert.throws(
        () => lyrics.getConfiguredPublicLyricsIndexUrl(),
        /Invalid NEXT_PUBLIC_LYRICS_BASE_URL/,
        unsafe,
      );
    }

    delete process.env.NEXT_PUBLIC_LYRICS_BASE_URL;
    const missing = await importPublicLyrics("missing");
    assert.throws(
      () => missing.getConfiguredPublicLyricsIndexUrl(),
      /NEXT_PUBLIC_LYRICS_BASE_URL is required/,
      "missing source must not silently select a product default",
    );
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build-time lyrics fetch retries schema and transport failures from its single source", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
    BUILD_FETCH_TIMEOUT_MS: process.env.BUILD_FETCH_TIMEOUT_MS,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    process.env.BUILD_FETCH_RETRIES = "2";
    process.env.BUILD_FETCH_TIMEOUT_MS = String(TEST_FETCH_TIMEOUT_MS);
    const canonicalIndex = readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json");
    let calls = 0;
    const transportFailureAttempt = ATTEMPT_INCREMENT;
    const schemaFailureAttempt = transportFailureAttempt + ATTEMPT_INCREMENT;
    globalThis.fetch = async (url, options) => {
      calls += ATTEMPT_INCREMENT;
      assert.equal(String(url), `${PUBLIC_LYRICS_BASE_URL}/index.json`);
      assert.equal(options.headers.accept, "application/json");
      if (calls === transportFailureAttempt) throw new Error("getaddrinfo ENOTFOUND private-host.internal");
      if (calls === schemaFailureAttempt) return jsonResponse({});
      return jsonResponse(canonicalIndex);
    };
    const lyrics = await importPublicLyrics("retry");
    const index = await lyrics.fetchPublicLyricsIndex();
    const expectedAttempts = Number(process.env.BUILD_FETCH_RETRIES) + ATTEMPT_INCREMENT;
    assert.equal(calls, expectedAttempts);
    assert.deepEqual(index, canonicalIndex);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build-time lyrics fetch enforces the named artifact limit with bounded streaming", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    process.env.BUILD_FETCH_RETRIES = "0";
    const source = readWeb("scripts/lib/public-lyrics.mjs");
    assert.match(source, /const MAX_PUBLIC_LYRICS_ARTIFACT_BYTES =/);
    assert.match(source, /const DEFAULT_BUILD_FETCH_TIMEOUT_MS =/);
    assert.match(source, /const DEFAULT_BUILD_FETCH_RETRIES =/);
    assert.match(source, /const BUILD_FETCH_RETRY_DELAY_MS =/);
    const limitExpression = source.match(/const MAX_PUBLIC_LYRICS_ARTIFACT_BYTES = ([^;]+);/)?.[1];
    assert.ok(limitExpression);
    const artifactLimitBytes = Function(`return (${limitExpression})`)();
    assert.doesNotMatch(source, /response\.(?:json|arrayBuffer)\(/);

    let pulled = 0;
    globalThis.fetch = async () => new Response(new ReadableStream({
      pull(controller) {
        pulled += ATTEMPT_INCREMENT;
        controller.enqueue(new Uint8Array(artifactLimitBytes + OVERSIZED_BYTE_INCREMENT));
        controller.close();
      },
    }), {
      status: HTTP_OK,
      headers: { "content-type": "application/json" },
    });
    const lyrics = await importPublicLyrics("oversized-stream");
    await assert.rejects(lyrics.fetchPublicLyricsIndex(), /too large/);
    assert.ok(pulled > 0);

    const canonicalIndex = readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json");
    globalThis.fetch = async () => jsonResponse(canonicalIndex, {
      headers: {
        "content-type": "application/json",
        "content-length": "1",
        "content-encoding": "gzip",
      },
    });
    const decodedLength = await importPublicLyrics("decoded-content-length");
    assert.deepEqual(await decodedLength.fetchPublicLyricsIndex(), canonicalIndex);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build-time lyrics fetch sanitizes final failures without source URLs or raw network details", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    process.env.BUILD_FETCH_RETRIES = "1";
    const privateDetail = "getaddrinfo ENOTFOUND private-host.internal";
    const secretLikeDetail = "token=secret-value";
    globalThis.fetch = async () => { throw new Error(`${privateDetail} ${secretLikeDetail}`); };
    const lyrics = await importPublicLyrics("sanitized-error");
    await assert.rejects(
      lyrics.fetchPublicLyricsIndex(),
      (error) => error.message === "Failed to fetch public lyrics index: transport failure"
        && !error.message.includes(PUBLIC_LYRICS_BASE_URL)
        && !error.message.includes(privateDetail)
        && !error.message.includes(secretLikeDetail),
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("sitemap generation follows the public lyrics index and excludes unpublished details", async () => {
  const generatorUrl = pathToFileURL(path.join(WEB_ROOT, "scripts/generate-sitemaps.mjs"));
  const generator = await import(`${generatorUrl.href}?test=published-lyrics-routes`);
  const index = readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json");
  const publication = index.songs[0];
  const unpublishedId = Number.MAX_SAFE_INTEGER;
  const existingLastmod = new Date(0).toISOString();
  const existingData = {
    detailRoutes: [
      { path: `/lyrics/${publication.musicId}/`, lastmod: existingLastmod },
      { path: `/lyrics/${unpublishedId}/`, lastmod: existingLastmod },
    ],
  };

  const routes = generator.buildPublishedLyricsRoutes(index, existingData);
  const expectedRoute = {
    path: `/lyrics/${publication.musicId}/`,
    lastmod: new Date(publication.updatedAt).toISOString(),
    priority: routes[0].priority,
    changefreq: routes[0].changefreq,
  };
  assert.deepEqual(routes, [expectedRoute]);
  assert.equal(routes.some((route) => route.path === `/lyrics/${unpublishedId}/`), false);
  assert.deepEqual(Object.keys(routes[0]), ["path", "lastmod", "priority", "changefreq"]);

  const privateIndex = structuredClone(index);
  privateIndex.songs[0].sourceUrl = new URL("source", PUBLIC_LYRICS_BASE_URL).toString();
  assert.throws(() => generator.buildPublishedLyricsRoutes(privateIndex, existingData), /Invalid public lyrics index/);
});

async function importSitemap() {
  const localeRouting = await importWebTypeScript("src/lib/locale-routing.ts", [[
    'import type { UiLocale } from "./i18n/locales";',
    'type UiLocale = string;',
  ]]);
  const routeLocales = [...localeRouting.SUPPORTED_ROUTE_LOCALES];
  const regionByLocale = Object.fromEntries(
    routeLocales.map((locale) => [locale, localeRouting.getLocaleRouteConfig(locale).defaultServer]),
  );
  const generatedAtByRegion = Object.fromEntries(
    [...new Set(Object.values(regionByLocale))].map((region, index) => [region, new Date((index + ATTEMPT_INCREMENT) * MILLISECONDS_PER_DAY).toISOString()]),
  );
  const dependencyKey = "__moesekaiSitemapDeps";
  globalThis[dependencyKey] = {
    routeLocaleCount: routeLocales.length,
    regionByLocale,
    generatedAtByRegion,
    fs: {
      existsSync: () => true,
      readFileSync(filePath) {
        const region = String(filePath).match(/sitemap-data\.([a-z]+)\.json$/)?.[1] ?? "jp";
        return JSON.stringify({ generatedAt: generatedAtByRegion[region], mainRoutes: [], detailRoutes: [] });
      },
    },
    path: { join: (...parts) => parts.join("/") },
    getCanonicalOrigin: () => SITEMAP_TEST_ORIGIN,
    INDEXABLE_SEO_ROUTES: [],
    DEFAULT_ROUTE_LOCALE: localeRouting.DEFAULT_ROUTE_LOCALE,
    SUPPORTED_ROUTE_LOCALES: routeLocales,
    getLocaleRouteConfig: localeRouting.getLocaleRouteConfig,
  };

  let source = readWeb("src/lib/sitemap.ts");
  const substitutions = [
    ["import fs from 'fs';", `const fs = globalThis.${dependencyKey}.fs;`],
    ["import path from 'path';", `const path = globalThis.${dependencyKey}.path;`],
    ["import { getCanonicalOrigin } from '@/lib/site-origin';", `const getCanonicalOrigin = globalThis.${dependencyKey}.getCanonicalOrigin;`],
    ["import { INDEXABLE_SEO_ROUTES } from '@/lib/seo-routes';", `const INDEXABLE_SEO_ROUTES = globalThis.${dependencyKey}.INDEXABLE_SEO_ROUTES;`],
    [
      "import { DEFAULT_ROUTE_LOCALE, getLocaleRouteConfig, SUPPORTED_ROUTE_LOCALES, type RouteLocale } from '@/lib/locale-routing';",
      `const { DEFAULT_ROUTE_LOCALE, getLocaleRouteConfig, SUPPORTED_ROUTE_LOCALES } = globalThis.${dependencyKey};\ntype RouteLocale = string;`,
    ],
  ];
  for (const [from, to] of substitutions) {
    assert.ok(source.includes(from), `missing sitemap substitution: ${from}`);
    source = source.replace(from, to);
  }
  return importTypeScriptSource(source, "sitemap-characterization");
}

test("sitemap indexes derive deterministic lastmod values from generated artifacts", async () => {
  assert.doesNotMatch(readWeb("src/lib/sitemap.ts"), /new Date\(\)\.toISOString\(\)/);
  try {
    const sitemap = await importSitemap();
    const first = sitemap.buildSitemapIndex(SITEMAP_TEST_ORIGIN);
    const second = sitemap.buildSitemapIndex(SITEMAP_TEST_ORIGIN);
    assert.equal(second, first);
    const deps = globalThis.__moesekaiSitemapDeps;
    const generatedDates = Object.values(deps.generatedAtByRegion).sort();
    const latestGeneratedAt = generatedDates[generatedDates.length - ATTEMPT_INCREMENT];
    assert.ok(latestGeneratedAt);
    assert.match(first, new RegExp(`sitemap-main\\.xml<\\/loc>\\s*<lastmod>${latestGeneratedAt}<\\/lastmod>`));
    for (const locale of deps.SUPPORTED_ROUTE_LOCALES) {
      const region = deps.regionByLocale[locale];
      assert.match(first, new RegExp(`sitemap-details/${locale}\\.xml<\\/loc>\\s*<lastmod>${deps.generatedAtByRegion[region]}<\\/lastmod>`));
    }

    const detailsFirst = sitemap.buildDetailsSitemapIndex(SITEMAP_TEST_ORIGIN);
    const detailsSecond = sitemap.buildDetailsSitemapIndex(SITEMAP_TEST_ORIGIN);
    assert.equal(detailsSecond, detailsFirst);
    assert.equal((detailsFirst.match(/<lastmod>/g) ?? []).length, deps.routeLocaleCount);
  } finally {
    delete globalThis.__moesekaiSitemapDeps;
  }
});
