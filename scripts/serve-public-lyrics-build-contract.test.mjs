import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("build-contract fixture exposes only the canonical empty public lyrics index", () => {
  const response = invoke("GET", BUILD_CONTRACT_INDEX_PATH);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(Number(response.headers["content-length"]), BUILD_CONTRACT_INDEX_BYTES.byteLength);
  assert.equal(response.body.toString("utf8"), '{"version":1,"songs":[]}');
  assert.deepEqual(JSON.parse(response.body), { version: 1, songs: [] });
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

  for (const [method, url] of [
    ["GET", "/files/translation/lyrics/music_1.json"],
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
