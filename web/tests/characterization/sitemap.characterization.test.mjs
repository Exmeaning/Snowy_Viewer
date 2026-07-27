import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import {
  importTypeScriptSource,
  readJson,
  readWeb,
  WEB_ROOT,
} from "./test-helpers.mjs";

test("build-time lyrics index follows the same credential-free HTTPS base as the client", async () => {
  const moduleUrl = pathToFileURL(path.join(WEB_ROOT, "scripts/lib/public-lyrics.mjs"));
  const original = {
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    PUBLIC_LYRICS_INDEX_URLS: process.env.PUBLIC_LYRICS_INDEX_URLS,
  };
  try {
    delete process.env.PUBLIC_LYRICS_INDEX_URLS;
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = "https://lyrics.example.com/public/";
    let lyrics = await import(`${moduleUrl.href}?test=${Date.now()}`);
    assert.deepEqual(lyrics.getConfiguredPublicLyricsIndexUrls(), ["https://lyrics.example.com/public/index.json"]);

    for (const unsafe of [
      "http://127.0.0.1:18081/files/translation/lyrics",
      "https://user:password@example.com/files/translation/lyrics",
      "https://example.com/files/translation/lyrics?token=secret",
      "https://example.com/",
      "not-a-url",
    ]) {
      process.env.NEXT_PUBLIC_LYRICS_BASE_URL = unsafe;
      lyrics = await import(`${moduleUrl.href}?test=${Date.now()}-${encodeURIComponent(unsafe)}`);
      assert.deepEqual(
        lyrics.getConfiguredPublicLyricsIndexUrls(),
        ["https://translation.exmeaning.com/files/translation/lyrics/index.json"],
        unsafe,
      );
    }

    process.env.PUBLIC_LYRICS_INDEX_URLS = [
      "https://first.example/lyrics/index.json",
      "http://plaintext.example/lyrics/index.json",
      "https://first.example/lyrics/index.json",
      "https://raw.githubusercontent.com/example/project/revision/index.fixture.json",
      "https://second.example/lyrics/index.json?token=secret",
    ].join(",");
    lyrics = await import(`${moduleUrl.href}?test=${Date.now()}-explicit`);
    assert.deepEqual(lyrics.getConfiguredPublicLyricsIndexUrls(), [
      "https://first.example/lyrics/index.json",
      "https://raw.githubusercontent.com/example/project/revision/index.fixture.json",
    ]);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("sitemap generation follows the public lyrics index and excludes unpublished details", async () => {
  const generatorUrl = pathToFileURL(path.join(WEB_ROOT, "scripts/generate-sitemaps.mjs"));
  const generator = await import(`${generatorUrl.href}?test=${Date.now()}`);
  const index = readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json");
  const existingData = {
    detailRoutes: [
      { path: "/lyrics/10/", lastmod: "2020-01-01T00:00:00.000Z" },
      { path: "/lyrics/999/", lastmod: "2020-01-01T00:00:00.000Z" },
    ],
  };

  const routes = generator.buildPublishedLyricsRoutes(index, existingData);
  assert.deepEqual(routes, [{
    path: "/lyrics/10/",
    lastmod: "2026-07-23T00:00:00.000Z",
    priority: 0.6,
    changefreq: "weekly",
  }]);
  assert.equal(routes.some((route) => route.path === "/lyrics/999/"), false);
  assert.deepEqual(Object.keys(routes[0]), ["path", "lastmod", "priority", "changefreq"]);

  const privateIndex = structuredClone(index);
  privateIndex.songs[0].sourceUrl = "https://private.example/source";
  assert.throws(() => generator.buildPublishedLyricsRoutes(privateIndex, existingData), /Invalid public lyrics index/);
});

async function importSitemap() {
  const routeLocales = ["zh-cn", "zh-tw", "en-us", "ja-jp", "ko-kr"];
  const regionByLocale = {
    "zh-cn": "cn",
    "zh-tw": "tw",
    "en-us": "en",
    "ja-jp": "jp",
    "ko-kr": "kr",
  };
  const generatedAtByRegion = {
    cn: "2026-01-01T00:00:00.000Z",
    tw: "2026-01-02T00:00:00.000Z",
    en: "2026-01-03T00:00:00.000Z",
    jp: "2026-01-04T00:00:00.000Z",
    kr: "2026-01-05T00:00:00.000Z",
  };
  const dependencyKey = "__moesekaiSitemapDeps";
  globalThis[dependencyKey] = {
    fs: {
      existsSync: () => true,
      readFileSync(filePath) {
        const region = String(filePath).match(/sitemap-data\.([a-z]+)\.json$/)?.[1] ?? "jp";
        return JSON.stringify({ generatedAt: generatedAtByRegion[region], mainRoutes: [], detailRoutes: [] });
      },
    },
    path: { join: (...parts) => parts.join("/") },
    getCanonicalOrigin: () => "https://pjsk.moe",
    INDEXABLE_SEO_ROUTES: [],
    DEFAULT_ROUTE_LOCALE: "zh-cn",
    SUPPORTED_ROUTE_LOCALES: routeLocales,
    getLocaleRouteConfig: (locale) => ({ defaultServer: regionByLocale[locale], uiLocale: locale }),
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
  const sitemap = await importSitemap();

  const first = sitemap.buildSitemapIndex("https://pjsk.moe");
  const second = sitemap.buildSitemapIndex("https://pjsk.moe");
  assert.equal(second, first);
  assert.match(first, /sitemap-main\.xml<\/loc>\s*<lastmod>2026-01-05T00:00:00\.000Z<\/lastmod>/);
  assert.match(first, /sitemap-details\/zh-cn\.xml<\/loc>\s*<lastmod>2026-01-01T00:00:00\.000Z<\/lastmod>/);
  assert.match(first, /sitemap-details\/ja-jp\.xml<\/loc>\s*<lastmod>2026-01-04T00:00:00\.000Z<\/lastmod>/);

  const detailsFirst = sitemap.buildDetailsSitemapIndex("https://pjsk.moe");
  const detailsSecond = sitemap.buildDetailsSitemapIndex("https://pjsk.moe");
  assert.equal(detailsSecond, detailsFirst);
  assert.equal((detailsFirst.match(/<lastmod>/g) ?? []).length, 5);
});
