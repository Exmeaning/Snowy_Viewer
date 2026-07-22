import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT } from "./test-helpers.mjs";

function readRepo(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("workflows pin actions, declare least privilege, and validate Go plus web", () => {
  for (const workflow of ["ci.yml", "screenshots.yml", "watch-master-data.yml"]) {
    const source = readRepo(`.github/workflows/${workflow}`);
    assert.doesNotMatch(source, /uses:\s+[^\s]+@v\d+/);
    assert.match(source, /uses:\s+[^\s]+@[0-9a-f]{40}/);
    assert.match(source, /permissions:/);
  }

  const ci = readRepo(".github/workflows/ci.yml");
  assert.match(ci, /permissions:\s*\n\s+contents: read/);
  assert.match(ci, /go test \.\/\.\.\./);
  assert.match(ci, /go test -race \.\/\.\.\./);
  assert.match(ci, /go vet \.\/\.\.\./);
  assert.match(ci, /Dockerfile\.backend/);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "Dockerfile.go")), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "Dockerfile.backend")), true);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, "docs/DEPLOYMENT_ROLLBACK.md")));
});
