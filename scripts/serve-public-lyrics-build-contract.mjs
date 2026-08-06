#!/usr/bin/env node

import fs from "node:fs";
import https from "node:https";
import { pathToFileURL } from "node:url";

export const BUILD_CONTRACT_INDEX_PATH = "/files/translation/lyrics/index.json";
export const BUILD_CONTRACT_INDEX_BYTES = Buffer.from('{"version":2,"songs":[{"musicId":10,"revision":4,"updatedAt":"2026-07-31T00:00:00Z","title":{"ja-JP":"新曲"},"state":"complete","availableVersions":["full","game"]}]}', "utf8");

export function handleBuildContractRequest(request, response) {
  const method = String(request.method || "");
  if ((method !== "GET" && method !== "HEAD") || request.url !== BUILD_CONTRACT_INDEX_PATH) {
    response.writeHead(404, {
      "cache-control": "no-store",
      "content-length": "0",
    });
    response.end();
    return;
  }

  response.writeHead(200, {
    "cache-control": "no-store",
    "content-length": String(BUILD_CONTRACT_INDEX_BYTES.byteLength),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(method === "HEAD" ? undefined : BUILD_CONTRACT_INDEX_BYTES);
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    throw new Error(`${name} is required`);
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

export function startBuildContractServer({ certPath, host, keyPath, portFile }) {
  if (!certPath || !keyPath || !portFile || !host) {
    throw new Error("certPath, host, keyPath, and portFile are required");
  }
  if (host !== "127.0.0.1" && host !== "0.0.0.0") {
    throw new Error("host must be 127.0.0.1 or 0.0.0.0");
  }

  const server = https.createServer({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    minVersion: "TLSv1.2",
  }, handleBuildContractRequest);
  server.headersTimeout = 5_000;
  server.requestTimeout = 5_000;
  server.keepAliveTimeout = 1_000;

  server.listen(0, host, () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("failed to allocate build-contract listener");
    }
    fs.writeFileSync(portFile, `${address.port}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  });
  return server;
}

function main() {
  const server = startBuildContractServer({
    certPath: readOption("--cert"),
    host: readOption("--host"),
    keyPath: readOption("--key"),
    portFile: readOption("--port-file"),
  });

  let shuttingDown = false;
  const shutdown = (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      process.exit(exitCode);
    }, 2_000);
    deadline.unref();
    server.close(() => {
      clearTimeout(deadline);
      process.exit(exitCode);
    });
  };
  process.once("SIGINT", () => shutdown(0));
  process.once("SIGTERM", () => shutdown(0));
  server.once("error", (error) => {
    console.error(`public lyrics build-contract server failed: ${error.message}`);
    shutdown(1);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
