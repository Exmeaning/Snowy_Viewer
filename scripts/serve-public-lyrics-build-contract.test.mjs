import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILD_CONTRACT_DETAIL_BYTES,
  BUILD_CONTRACT_DETAIL_PATH,
  BUILD_CONTRACT_INDEX_BYTES,
  BUILD_CONTRACT_INDEX_PATH,
  handleBuildContractRequest,
  startBuildContractServer,
} from "./serve-public-lyrics-build-contract.mjs";

function invoke(method, url) {
  const headers = {};
  const chunks = [];
  let statusCode = 0;
  const response = {
    writeHead(status, values) {
      statusCode = status;
      Object.assign(headers, values);
    },
    end(chunk) {
      if (chunk !== undefined) chunks.push(Buffer.from(chunk));
    },
  };
  handleBuildContractRequest({ method, url }, response);
  return { statusCode, headers, body: Buffer.concat(chunks) };
}

test("build-contract fixture exposes a minimal strict Public Lyrics v4 index", () => {
  const response = invoke("GET", BUILD_CONTRACT_INDEX_PATH);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(Number(response.headers["content-length"]), BUILD_CONTRACT_INDEX_BYTES.byteLength);
  assert.equal(response.body.toString("utf8"), '{"version":4,"songs":[{"musicId":10,"revision":4,"updatedAt":"2026-07-31T00:00:00Z","title":{"ja-JP":"新曲"},"state":"complete","availableVersions":["full"]}]}');
  assert.deepEqual(JSON.parse(response.body), {
    version: 4,
    songs: [{
      musicId: 10,
      revision: 4,
      updatedAt: "2026-07-31T00:00:00Z",
      title: { "ja-JP": "新曲" },
      state: "complete",
      availableVersions: ["full"],
    }],
  });
});

test("build-contract fixture exposes a matching strict Public Lyrics v4 detail", () => {
  const response = invoke("GET", BUILD_CONTRACT_DETAIL_PATH);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(Number(response.headers["content-length"]), BUILD_CONTRACT_DETAIL_BYTES.byteLength);
  assert.deepEqual(JSON.parse(response.body), {
    version: 4,
    musicId: 10,
    revision: 4,
    updatedAt: "2026-07-31T00:00:00Z",
    state: "complete",
    defaultTranslationEditionKey: "build-contract",
    translationEditions: [{
      key: "build-contract",
      label: "Build Contract",
      renditions: [{
        renditionKey: "original",
        translationCredits: { translation: "Build Contract Translator" },
        full: { translations: ["歌唱"] },
      }],
    }],
    renditions: [{
      key: "original",
      kind: "original",
      label: "Original Version",
      availableVersions: ["full"],
      performers: [],
      full: {
        version: { kind: "original", label: "Original Version" },
        lines: [{
          id: "full-000001",
          order: 0,
          japanese: "歌う",
          segments: [{
            text: "歌う",
            performerIds: [],
            ruby: [{ text: "歌", reading: "うた" }, { text: "う" }],
          }],
          trailingPerformerIds: [],
        }],
      },
      relation: { kind: "none" },
      sourceTabPaths: [["Original Version"]],
      provenance: [
        {
          component: "renditions/original/full_text",
          provider: "vocaloid_fandom",
          title: "Original Version",
          revisionId: 1201,
          revisionUrl: "https://vocaloid.fandom.com/wiki/Public_Test?oldid=1201",
          licenseName: "CC BY-SA 3.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
        },
        {
          component: "renditions/original/relation",
          provider: "vocaloid_fandom",
          title: "Original Version",
          revisionId: 1201,
          revisionUrl: "https://vocaloid.fandom.com/wiki/Public_Test?oldid=1201",
          licenseName: "CC BY-SA 3.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
        },
        {
          component: "renditions/original/version",
          provider: "vocaloid_fandom",
          title: "Original Version",
          revisionId: 1201,
          revisionUrl: "https://vocaloid.fandom.com/wiki/Public_Test?oldid=1201",
          licenseName: "CC BY-SA 3.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
        },
      ],
    }],
  });
});

test("build-contract listener accepts only explicit loopback or all-interface hosts", () => {
  assert.throws(
    () => startBuildContractServer({ certPath: "unused", host: "192.0.2.1", keyPath: "unused", portFile: "unused" }),
    /host must be 127\.0\.0\.1 or 0\.0\.0\.0/,
  );
});

test("build-contract fixture supports HEAD without exposing additional routes or methods", () => {
  const head = invoke("HEAD", BUILD_CONTRACT_INDEX_PATH);
  assert.equal(head.statusCode, 200);
  assert.equal(head.body.byteLength, 0);
  assert.equal(Number(head.headers["content-length"]), BUILD_CONTRACT_INDEX_BYTES.byteLength);

  const detailHead = invoke("HEAD", BUILD_CONTRACT_DETAIL_PATH);
  assert.equal(detailHead.statusCode, 200);
  assert.equal(detailHead.body.byteLength, 0);
  assert.equal(Number(detailHead.headers["content-length"]), BUILD_CONTRACT_DETAIL_BYTES.byteLength);

  for (const [method, url] of [
    ["GET", "/files/translation/lyrics/music_1.json"],
    ["GET", "/translation/lyrics/music_10.json"],
    ["GET", "/translation/lyrics/index.json"],
    ["POST", BUILD_CONTRACT_INDEX_PATH],
    ["get", BUILD_CONTRACT_INDEX_PATH],
    ["hEaD", BUILD_CONTRACT_INDEX_PATH],
    ["GET", `${BUILD_CONTRACT_INDEX_PATH}?token=secret`],
  ]) {
    const response = invoke(method, url);
    assert.equal(response.statusCode, 404, `${method} ${url}`);
    assert.equal(response.body.byteLength, 0);
  }
});
