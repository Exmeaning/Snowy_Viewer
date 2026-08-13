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
const HTTP_MULTIPLE_CHOICES = 300;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_CLIENT_CLOSED_REQUEST = 499;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_NETWORK_AUTHENTICATION_REQUIRED = 511;
const HTTP_NETWORK_CONNECT_TIMEOUT_ERROR = 599;
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
const STRICT_JSON_MAX_DEPTH = 64;
const STRICT_JSON_OVERFLOW_DEPTH = STRICT_JSON_MAX_DEPTH + ATTEMPT_INCREMENT;
const JSON_ROOT_MEMBER_DEPTH = 2;

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

function nestedJsonValueAtDepth(depth, startingDepth = ATTEMPT_INCREMENT) {
  return `${"[".repeat(depth - startingDepth)}0${"]".repeat(depth - startingDepth)}`;
}

function replaceRawJsonToken(body, token, replacement, label) {
  const replaced = body.replace(token, replacement);
  assert.notEqual(replaced, body, `raw JSON mutation must match ${label}`);
  return replaced;
}

let publicLyricsModuleSequence = 0;

function importPublicLyrics(label) {
  publicLyricsModuleSequence += ATTEMPT_INCREMENT;
  const moduleUrl = pathToFileURL(path.join(WEB_ROOT, "scripts/lib/public-lyrics.mjs"));
  return import(`${moduleUrl.href}?test=${publicLyricsModuleSequence}-${label}`);
}

function getDefaultBuildFetchAttempts() {
  const source = readWeb("scripts/lib/public-lyrics.mjs");
  const retriesExpression = source.match(/const DEFAULT_BUILD_FETCH_RETRIES = ([^;]+);/)?.[1];
  assert.ok(retriesExpression);
  return Function(`return (${retriesExpression})`)() + ATTEMPT_INCREMENT;
}

function useImmediateRetryDelays() {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => {
    queueMicrotask(callback);
    return ATTEMPT_INCREMENT;
  };
  return () => {
    globalThis.setTimeout = originalSetTimeout;
  };
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
    assert.equal(
      missing.getConfiguredPublicLyricsIndexUrl(),
      "https://translation.exmeaning.com/files/translation/lyrics/index.json",
      "missing source uses the reviewed production Public Lyrics directory",
    );
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build-time lyrics fetch retries only timeout, transport, and retryable HTTP failures with production defaults", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
    BUILD_FETCH_TIMEOUT_MS: process.env.BUILD_FETCH_TIMEOUT_MS,
  };
  const previousFetch = globalThis.fetch;
  const restoreSetTimeout = useImmediateRetryDelays();
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    delete process.env.BUILD_FETCH_RETRIES;
    process.env.BUILD_FETCH_TIMEOUT_MS = String(TEST_FETCH_TIMEOUT_MS);
    const canonicalIndex = readJson("tests/fixtures/next-public-lyrics-v2/index.fixture.json");
    const expectedAttempts = getDefaultBuildFetchAttempts();
    assert.ok(expectedAttempts > ATTEMPT_INCREMENT);

    const timeoutError = new Error("private timeout detail");
    timeoutError.name = "TimeoutError";
    for (const [label, failure] of [
      ["transport", () => { throw new Error("getaddrinfo ENOTFOUND private-host.internal"); }],
      ["timeout", () => { throw timeoutError; }],
      [`HTTP ${HTTP_REQUEST_TIMEOUT}`, () => new Response(null, { status: HTTP_REQUEST_TIMEOUT })],
      [`HTTP ${HTTP_TOO_MANY_REQUESTS}`, () => new Response(null, { status: HTTP_TOO_MANY_REQUESTS })],
      [`HTTP ${HTTP_INTERNAL_SERVER_ERROR}`, () => new Response(null, { status: HTTP_INTERNAL_SERVER_ERROR })],
      [`HTTP ${HTTP_NETWORK_AUTHENTICATION_REQUIRED}`, () => new Response(null, { status: HTTP_NETWORK_AUTHENTICATION_REQUIRED })],
      [`HTTP ${HTTP_NETWORK_CONNECT_TIMEOUT_ERROR}`, () => new Response(null, { status: HTTP_NETWORK_CONNECT_TIMEOUT_ERROR })],
    ]) {
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        calls += ATTEMPT_INCREMENT;
        assert.equal(String(url), `${PUBLIC_LYRICS_BASE_URL}/index.json`);
        assert.equal(options.headers.accept, "application/json");
        return calls < expectedAttempts ? failure() : jsonResponse(canonicalIndex);
      };
      const lyrics = await importPublicLyrics(`retry-${label}`);
      assert.deepEqual(await lyrics.fetchPublicLyricsIndex(), canonicalIndex, label);
      assert.equal(calls, expectedAttempts, `${label} must consume the production-default attempts`);
    }
  } finally {
    restoreSetTimeout();
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build-time lyrics fetch never retries non-retryable HTTP or schema failures with production defaults", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    delete process.env.BUILD_FETCH_RETRIES;
    assert.ok(getDefaultBuildFetchAttempts() > ATTEMPT_INCREMENT);

    const canonicalIndex = readJson("tests/fixtures/next-public-lyrics-v2/index.fixture.json");
    const unknownFieldIndex = structuredClone(canonicalIndex);
    unknownFieldIndex.privateUnknownField = "must-not-leak";
    for (const [label, fetchImpl, expectedDetail] of [
      [`HTTP ${HTTP_MULTIPLE_CHOICES}`, async () => new Response(null, { status: HTTP_MULTIPLE_CHOICES }), `HTTP ${HTTP_MULTIPLE_CHOICES}`],
      [`HTTP ${HTTP_NOT_FOUND}`, async () => new Response(null, { status: HTTP_NOT_FOUND }), `HTTP ${HTTP_NOT_FOUND}`],
      [`HTTP ${HTTP_CLIENT_CLOSED_REQUEST}`, async () => new Response(null, { status: HTTP_CLIENT_CLOSED_REQUEST }), `HTTP ${HTTP_CLIENT_CLOSED_REQUEST}`],
      ["schema", async () => jsonResponse({}), "Invalid public lyrics index"],
      ["unknown-field", async () => jsonResponse(unknownFieldIndex), "Invalid public lyrics index"],
    ]) {
      let calls = 0;
      globalThis.fetch = async (...args) => {
        calls += ATTEMPT_INCREMENT;
        return fetchImpl(...args);
      };
      const lyrics = await importPublicLyrics(`non-retryable-${label}`);
      await assert.rejects(
        lyrics.fetchPublicLyricsIndex(),
        (error) => error.message === `Failed to fetch public lyrics index: ${expectedDetail}`
          && !error.message.includes("must-not-leak"),
        label,
      );
      assert.equal(calls, ATTEMPT_INCREMENT, `${label} must fail without retry`);
    }
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build-time lyrics index validation accepts strict v1, v2, and v3", async () => {
  const lyrics = await importPublicLyrics("triple-schema");
  const v1 = readJson("tests/fixtures/next-public-lyrics-v1/index.fixture.json");
  const v2 = readJson("tests/fixtures/next-public-lyrics-v2/index.fixture.json");
  const v3 = structuredClone(v2);
  v3.version = 3;
  assert.equal(lyrics.PUBLIC_LYRICS_SCHEMA_VERSION, 3);
  assert.deepEqual(lyrics.validatePublicLyricsIndex(structuredClone(v1)), v1);
  assert.deepEqual(lyrics.validatePublicLyricsIndex(structuredClone(v2)), v2);
  assert.deepEqual(lyrics.validatePublicLyricsIndex(structuredClone(v3)), v3);

  const malformedV2 = structuredClone(v2);
  malformedV2.songs[0].availableVersions = ["game", "full"];
  assert.throws(() => lyrics.validatePublicLyricsIndex(malformedV2), /Invalid public lyrics index/);
  const malformedV3Complete = structuredClone(v3);
  malformedV3Complete.songs[0].availableVersions = ["game"];
  assert.throws(() => lyrics.validatePublicLyricsIndex(malformedV3Complete), /Invalid public lyrics index/);
  assert.throws(() => lyrics.validatePublicLyricsIndex({ version: 3, songs: [] }), /Invalid public lyrics index/);
  const v1WithV2Field = structuredClone(v1);
  v1WithV2Field.songs[0].availableVersions = ["full"];
  assert.throws(() => lyrics.validatePublicLyricsIndex(v1WithV2Field), /Invalid public lyrics index/);
});

test("build-time lyrics index uses the shared strict JSON boundary", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    delete process.env.BUILD_FETCH_RETRIES;
    assert.ok(getDefaultBuildFetchAttempts() > ATTEMPT_INCREMENT);
    const canonicalIndex = readJson("tests/fixtures/next-public-lyrics-v2/index.fixture.json");
    const indexRaw = JSON.stringify(canonicalIndex);
    const publication = canonicalIndex.songs[0];
    const versionToken = `"version":${canonicalIndex.version}`;
    const musicIdToken = `"musicId":${publication.musicId}`;
    const titleObjectToken = `"title":${JSON.stringify(publication.title)}`;
    const titleValue = JSON.stringify(publication.title["ja-JP"]);
    const titleToken = `"ja-JP":${titleValue}`;
    const privateMarker = "private-build-json-marker";
    const invalidCases = [
      ["duplicate version", replaceRawJsonToken(indexRaw, versionToken, `${versionToken},${versionToken}`, "duplicate version")],
      ["duplicate musicId", replaceRawJsonToken(indexRaw, musicIdToken, `${musicIdToken},${musicIdToken}`, "duplicate musicId")],
      ["duplicate title", replaceRawJsonToken(indexRaw, titleObjectToken, `${titleObjectToken},${titleObjectToken}`, "duplicate title")],
      ["escaped-equivalent title", replaceRawJsonToken(indexRaw, titleToken, `${titleToken},"\\u006aa-JP":${titleValue}`, "escaped title")],
      ["lone high surrogate", replaceRawJsonToken(indexRaw, titleToken, '"ja-JP":"\\uD800"', "high surrogate")],
      ["lone low surrogate", replaceRawJsonToken(indexRaw, titleToken, '"ja-JP":"\\uDC00"', "low surrogate")],
      ["trailing value", `${indexRaw} {"${privateMarker}":true}`],
      ["UTF-8 BOM", Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(indexRaw, "utf8")])],
      ["invalid UTF-8", Uint8Array.from([0x7B, 0x22, 0xFF, 0x22, 0x3A, 0x31, 0x7D])],
    ];

    for (const [label, body] of invalidCases) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += ATTEMPT_INCREMENT;
        return rawJsonResponse(body);
      };
      const lyrics = await importPublicLyrics(`strict-json-${label}`);
      await assert.rejects(
        lyrics.fetchPublicLyricsIndex(),
        (error) => error.message === "Failed to fetch public lyrics index: Invalid public lyrics JSON"
          && !error.message.includes(privateMarker),
        label,
      );
      assert.equal(calls, ATTEMPT_INCREMENT);
    }

    for (const [label, encodedTitle, expectedTitle] of [
      ["escaped-pair", '"\\uD83D\\uDE00"', "😀"],
      ["utf8-supplementary", JSON.stringify("補足😀"), "補足😀"],
    ]) {
      const body = replaceRawJsonToken(indexRaw, titleToken, `"ja-JP":${encodedTitle}`, label);
      globalThis.fetch = async () => rawJsonResponse(body);
      const lyrics = await importPublicLyrics(`strict-json-valid-${label}`);
      const index = await lyrics.fetchPublicLyricsIndex();
      assert.equal(index.songs[0].title["ja-JP"], expectedTitle);
    }

    const caseAliasBody = replaceRawJsonToken(
      indexRaw,
      versionToken,
      `${versionToken},"Version":${canonicalIndex.version}`,
      "case-alias version",
    );
    let caseAliasCalls = 0;
    globalThis.fetch = async () => {
      caseAliasCalls += ATTEMPT_INCREMENT;
      return rawJsonResponse(caseAliasBody);
    };
    const caseAlias = await importPublicLyrics("strict-json-case-alias");
    await assert.rejects(caseAlias.fetchPublicLyricsIndex(), /Invalid public lyrics index/);
    assert.equal(caseAliasCalls, ATTEMPT_INCREMENT, "unknown fields must fail without retry");

    for (const [depth, expected] of [
      [STRICT_JSON_MAX_DEPTH, /Invalid public lyrics index/],
      [STRICT_JSON_OVERFLOW_DEPTH, /Invalid public lyrics JSON/],
    ]) {
      let calls = 0;
      const body = `${indexRaw.slice(0, -ATTEMPT_INCREMENT)},"adversarial":${nestedJsonValueAtDepth(depth, JSON_ROOT_MEMBER_DEPTH)}}`;
      globalThis.fetch = async () => {
        calls += ATTEMPT_INCREMENT;
        return rawJsonResponse(body);
      };
      const lyrics = await importPublicLyrics(`strict-json-depth-${depth}`);
      await assert.rejects(lyrics.fetchPublicLyricsIndex(), expected, `depth ${depth}`);
      assert.equal(calls, ATTEMPT_INCREMENT);
    }
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("build-time lyrics body, size, and content-length failures remain deterministic with production defaults", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    delete process.env.BUILD_FETCH_RETRIES;
    assert.ok(getDefaultBuildFetchAttempts() > ATTEMPT_INCREMENT);
    const source = readWeb("scripts/lib/public-lyrics.mjs");
    assert.match(source, /const MAX_PUBLIC_LYRICS_ARTIFACT_BYTES =/);
    assert.match(source, /const DEFAULT_BUILD_FETCH_TIMEOUT_MS =/);
    assert.match(source, /const DEFAULT_BUILD_FETCH_RETRIES =/);
    assert.match(source, /const BUILD_FETCH_RETRY_DELAY_MS =/);
    assert.match(source, /const MAX_FINAL_ERROR_DETAIL_CHARS =/);
    assert.match(source, /parseStrictJson/);
    assert.match(source, /ignoreBOM: true/);
    assert.doesNotMatch(source, /JSON\.parse\(/);
    const strictJsonSource = readWeb("src/lib/strict-json.mjs");
    assert.match(strictJsonSource, /export const MAX_STRICT_JSON_DEPTH = 64;/);
    const limitExpression = source.match(/const MAX_PUBLIC_LYRICS_ARTIFACT_BYTES = ([^;]+);/)?.[1];
    assert.ok(limitExpression);
    const artifactLimitBytes = Function(`return (${limitExpression})`)();
    assert.doesNotMatch(source, /response\.(?:json|arrayBuffer)\(/);

    const privateCancelMarker = "reader.cancel private rejection";
    let pulled = 0;
    let cancelled = 0;
    const readerResponse = (contentLength, reader) => ({
      ok: true,
      status: HTTP_OK,
      headers: {
        get(name) {
          return name.toLowerCase() === "content-length" ? contentLength : null;
        },
      },
      body: {
        getReader() {
          return reader;
        },
      },
    });
    const rejectingCancel = async () => {
      cancelled += ATTEMPT_INCREMENT;
      throw new Error(privateCancelMarker);
    };
    const deterministicCases = [
      [
        "invalid-content-length",
        () => new Response("{}", { headers: { "content-length": "1e3" } }),
        "Invalid public lyrics content length",
      ],
      [
        "oversized-content-length",
        () => new Response("{}", { headers: { "content-length": String(artifactLimitBytes + OVERSIZED_BYTE_INCREMENT) } }),
        "Public lyrics index is too large",
      ],
      [
        "not-stream-readable",
        () => ({ ok: true, status: HTTP_OK, headers: new Headers(), body: null }),
        "Public lyrics index response is not stream-readable",
      ],
      [
        "non-callable-stream-reader",
        () => ({ ok: true, status: HTTP_OK, headers: new Headers(), body: { getReader: "invalid" } }),
        "Public lyrics index response is not stream-readable",
      ],
      [
        "reader-construction-failure",
        () => ({
          ok: true,
          status: HTTP_OK,
          headers: new Headers(),
          body: { getReader: () => { throw new Error(privateCancelMarker); } },
        }),
        "Invalid public lyrics response body",
      ],
      [
        "invalid-reader-shape",
        () => readerResponse(null, {}),
        "Invalid public lyrics response body",
      ],
      [
        "zero-body-cancel-rejection",
        () => readerResponse("0", { read: async () => ({ done: true }), cancel: rejectingCancel }),
        "Invalid public lyrics JSON",
      ],
      [
        "invalid-read-result-cancel-rejection",
        () => readerResponse(null, { read: async () => null, cancel: rejectingCancel }),
        "Invalid public lyrics response body",
      ],
      [
        "invalid-chunk-cancel-rejection",
        () => readerResponse(null, { read: async () => ({ done: false, value: "invalid" }), cancel: rejectingCancel }),
        "Invalid public lyrics response body",
      ],
      [
        "oversized-chunk-cancel-rejection",
        () => readerResponse(null, {
          read: async () => {
            pulled += ATTEMPT_INCREMENT;
            return { done: false, value: new Uint8Array(artifactLimitBytes + OVERSIZED_BYTE_INCREMENT) };
          },
          cancel: rejectingCancel,
        }),
        "Public lyrics index is too large",
      ],
      [
        "empty-stream",
        () => readerResponse(null, { read: async () => ({ done: true }), cancel: rejectingCancel }),
        "Invalid public lyrics JSON",
      ],
    ];

    for (const [label, responseFactory, expectedDetail] of deterministicCases) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += ATTEMPT_INCREMENT;
        return responseFactory();
      };
      const lyrics = await importPublicLyrics(label);
      await assert.rejects(
        lyrics.fetchPublicLyricsIndex(),
        (error) => error.message === `Failed to fetch public lyrics index: ${expectedDetail}`
          && !error.message.includes(privateCancelMarker),
        label,
      );
      assert.equal(calls, ATTEMPT_INCREMENT, `${label} must fail without retry`);
    }
    assert.equal(pulled, ATTEMPT_INCREMENT, "oversized streams stop after the first excessive chunk");
    assert.equal(cancelled, 4, "every cancellable deterministic early exit performs best-effort cleanup");

    const canonicalIndex = readJson("tests/fixtures/next-public-lyrics-v2/index.fixture.json");
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

test("build-time lyrics fetch sanitizes and bounds final retry failures with production defaults", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LYRICS_BASE_URL: process.env.NEXT_PUBLIC_LYRICS_BASE_URL,
    BUILD_FETCH_RETRIES: process.env.BUILD_FETCH_RETRIES,
  };
  const previousFetch = globalThis.fetch;
  const restoreSetTimeout = useImmediateRetryDelays();
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LYRICS_BASE_URL = PUBLIC_LYRICS_BASE_URL;
    delete process.env.BUILD_FETCH_RETRIES;
    const expectedAttempts = getDefaultBuildFetchAttempts();
    const source = readWeb("scripts/lib/public-lyrics.mjs");
    const maximumDetailExpression = source.match(/const MAX_FINAL_ERROR_DETAIL_CHARS = ([^;]+);/)?.[1];
    assert.ok(maximumDetailExpression);
    const maximumDetailChars = Function(`return (${maximumDetailExpression})`)();
    const privateDetail = "getaddrinfo ENOTFOUND private-host.internal";
    const secretLikeDetail = "token=secret-value".repeat(maximumDetailChars);
    let calls = 0;
    globalThis.fetch = async () => {
      calls += ATTEMPT_INCREMENT;
      throw new Error(`${privateDetail} ${secretLikeDetail}`);
    };
    const lyrics = await importPublicLyrics("sanitized-error");
    await assert.rejects(
      lyrics.fetchPublicLyricsIndex(),
      (error) => error.message === "Failed to fetch public lyrics index: transport failure"
        && error.message.length <= "Failed to fetch public lyrics index: ".length + maximumDetailChars + 3
        && !error.message.includes(PUBLIC_LYRICS_BASE_URL)
        && !error.message.includes(privateDetail)
        && !error.message.includes(secretLikeDetail),
    );
    assert.equal(calls, expectedAttempts);
  } finally {
    restoreSetTimeout();
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("strict sitemap mode rejects unreachable and schema-invalid public lyrics sources", async () => {
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

    for (const [label, fetchImpl, expected] of [
      ["unreachable", async () => { throw new Error("source unavailable"); }, /transport failure/],
      ["invalid-schema", async () => jsonResponse({ version: 1, songs: "invalid" }), /Invalid public lyrics index/],
    ]) {
      globalThis.fetch = fetchImpl;
      const lyrics = await importPublicLyrics(`strict-${label}`);
      await assert.rejects(lyrics.fetchPublicLyricsIndex(), expected);
    }
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

  const v3 = readJson("tests/fixtures/next-public-lyrics-v2/index.fixture.json");
  v3.version = 3;
  const v3Routes = generator.buildPublishedLyricsRoutes(v3, existingData);
  assert.deepEqual(v3Routes.map((route) => route.path), ["/lyrics/10/", "/lyrics/11/", "/lyrics/12/"]);
  assert.equal(v3Routes.some((route) => [13, 14, 15, 16, 17].some((musicId) => route.path === `/lyrics/${musicId}/`)), false);
  assert.deepEqual(generator.buildPublishedLyricsRoutes({ version: 2, songs: [] }, existingData), []);
  assert.match(readWeb("scripts/generate-sitemaps.mjs"), /fallback: \{ version: 2, songs: \[\] \}/);

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
