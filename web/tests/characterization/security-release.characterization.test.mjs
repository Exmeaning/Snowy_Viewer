import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";

import { importWebTypeScript, readWeb, REPO_ROOT } from "./test-helpers.mjs";

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

  const screenshots = readRepo(".github/workflows/screenshots.yml");
  assert.match(screenshots, /HUB_REPO: \$\{\{ vars\.SCREENSHOT_HUB_REPOSITORY \}\}/);
  assert.match(screenshots, /repository: \$\{\{ env\.HUB_REPO \}\}/);
  assert.match(screenshots, /token: \$\{\{ secrets\.HUB_DEPLOY_TOKEN \}\}/);
  assert.match(screenshots, /path: hub-repo[\s\S]*persist-credentials: false/);
  assert.match(screenshots, /\[\[ "\$HUB_REPO" =~ \^\[A-Za-z0-9_\.\-\]\+\/\[A-Za-z0-9_\.\-\]\+\$ \]\]/);
  const validationStep = screenshots.slice(
    screenshots.indexOf("      - name: Validate screenshot publication destination\n"),
    screenshots.indexOf("      - name: Checkout screenshot repository without URL credentials\n"),
  );
  assert.doesNotMatch(validationStep, /HUB_DEPLOY_TOKEN|secrets\./);
  const pushStep = screenshots.slice(screenshots.indexOf("      - name: Push screenshots with process-scoped authentication\n"));
  assert.match(pushStep, /GIT_ASKPASS="\$askpass" GIT_TERMINAL_PROMPT=0 git push origin HEAD/);
  assert.match(pushStep, /trap 'rm -f "\$askpass"' EXIT/);
  assert.doesNotMatch(pushStep, /extraheader|base64/);
  const commitStep = screenshots.slice(
    screenshots.indexOf("      - name: Commit screenshots to Hub repo\n"),
    screenshots.indexOf("      - name: Push screenshots with process-scoped authentication\n"),
  );
  assert.doesNotMatch(commitStep, /HUB_DEPLOY_TOKEN|secrets\./);
  assert.doesNotMatch(screenshots, new RegExp("https://x-access-" + "token:"));
  assert.doesNotMatch(screenshots, /git remote set-url origin/);

  const ci = readRepo(".github/workflows/ci.yml");
  assert.match(ci, /permissions:\s*\n\s+contents: read/);
  assert.match(ci, /go test \.\/\.\.\./);
  assert.match(ci, /go test -race \.\/\.\.\./);
  assert.match(ci, /go vet \.\/\.\.\./);
  assert.match(ci, /Dockerfile\.backend/);
  assert.match(ci, /calculator:[\s\S]*npm test -- --runInBand[\s\S]*npm run build[\s\S]*npm audit --omit=dev --audit-level=high[\s\S]*npm audit --audit-level=critical/);
  assert.match(ci, /docker build -f Dockerfile -t moesekai:test/);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "Dockerfile.go")), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "Dockerfile.backend")), true);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, "docs/DEPLOYMENT_ROLLBACK.md")));
});

test("production and web-dev images install from the frozen workspace root and run a hardened runtime", () => {
  const production = readRepo("Dockerfile");
  const development = readRepo("web/Dockerfile.dev");
  const compose = readRepo("docker-compose.dev.yml");

  assert.doesNotMatch(production, /FROM\s+[^\s]+:latest/);
  assert.match(production, /FROM oven\/bun:1\.3\.14/);
  assert.match(production, /COPY package\.json bun\.lock \.\//);
  assert.match(production, /RUN bun install --frozen-lockfile/);
  assert.match(production, /USER node/);
  assert.match(production, /HEALTHCHECK[\s\S]*\/readyz/);
  assert.match(production, /ENTRYPOINT \["\/sbin\/tini", "--"\]/);
  assert.match(production, /CMD \["\/app\/start\.sh"\]/);

  assert.match(development, /COPY package\.json bun\.lock \.\//);
  assert.match(development, /RUN bun install --frozen-lockfile/);
  assert.match(compose, /context: \.[\s\S]*dockerfile: web\/Dockerfile\.dev/);
});

test("privacy disclosures are localized, match disabled ads, and route external links", () => {
  const page = readWeb("src/app/privacy/page.tsx");
  const client = readWeb("src/app/privacy/client.tsx");
  assert.match(page, /PrivacyPolicyClient/);
  assert.match(client, /"local\.tokens"/);
  assert.match(client, /"local\.gameData"/);
  assert.match(client, /page\.privacy\.cookies\.adsDisabled/);
  assert.doesNotMatch(client, /<a\s/i);
  assert.equal((client.match(/<ExternalLink/g) ?? []).length, 2);
});

test("all JSON-LD uses one closing-script-safe serializer", async () => {
  const { serializeJsonLd } = await importWebTypeScript("src/lib/json-ld.ts");
  const payload = { name: "</script><script>window.__jsonLdExecuted = true</script>&\u2028" };
  const serialized = serializeJsonLd(payload);

  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/u);
  assert.deepEqual(JSON.parse(serialized), payload);

  const dom = new JSDOM(
    `<!doctype html><script type="application/ld+json">${serialized}</script>`,
    { runScripts: "dangerously" },
  );
  assert.equal(dom.window.__jsonLdExecuted, undefined);
  assert.equal(dom.window.document.scripts.length, 1, "the payload cannot close JSON-LD and create an executable script");
  dom.window.close();

  const seoMetadata = readWeb("src/lib/seo-metadata.ts");
  const rootLayout = readWeb("src/app/layout.tsx");
  assert.doesNotMatch(seoMetadata, /dangerouslySetInnerHTML:\s*\{ __html: JSON\.stringify/);
  assert.match(seoMetadata, /serializeJsonLd\(breadcrumbJsonLd\)/);
  assert.match(seoMetadata, /serializeJsonLd\(entityJsonLd\)/);
  assert.match(rootLayout, /import \{ serializeJsonLd \} from "@\/lib\/json-ld"/);
});

test("OAuth return routes reject external, protocol-relative, encoded, and control-character forms", async () => {
  const oauth = await importWebTypeScript("src/lib/oauth.ts", [[
    'import { localizePathForBrowser } from "@/lib/localized-path";',
    "const localizePathForBrowser = (value) => value;",
  ]]);

  assert.equal(oauth.sanitizeOAuthReturnTo("/cards?sort=id#top"), "/cards?sort=id#top");
  for (const unsafe of [
    "https://evil.example/",
    "//evil.example/",
    "///evil.example/",
    "/\\evil.example/",
    "/%5cevil.example/",
    "/%2f%2fevil.example/",
    "/profile\r\nLocation: https://evil.example/",
    "/profile%0d%0aLocation%3a%20https%3a%2f%2fevil.example/",
  ]) {
    assert.equal(oauth.sanitizeOAuthReturnTo(unsafe), "/profile", unsafe);
  }

  assert.match(readWeb("src/app/oauth2/connect/client.tsx"), /sanitizeOAuthReturnTo\(value\)/);
  assert.match(readWeb("src/app/oauth2/callback/code/client.tsx"), /sanitizeOAuthReturnTo\(returnTo\)/);
});

test("public origins are configured and never reflected from arbitrary request headers", async () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_DOMAIN: process.env.NEXT_PUBLIC_SITE_DOMAIN,
    PUBLIC_HOST_ALLOWLIST: process.env.PUBLIC_HOST_ALLOWLIST,
  };
  try {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_DOMAIN = "https://pjsk.moe";
    process.env.PUBLIC_HOST_ALLOWLIST = "www.pjsk.moe";
    const origins = await importWebTypeScript("src/lib/site-origin.ts");
    assert.equal(origins.getCanonicalOrigin(), "https://pjsk.moe");
    assert.equal(origins.getPublicRequestOrigin("https://evil.example"), "https://pjsk.moe");
    assert.equal(origins.getPublicRequestOrigin("http://www.pjsk.moe"), "https://pjsk.moe");
    process.env.NEXT_PUBLIC_SITE_DOMAIN = "https://evil.example/path";
    assert.equal(origins.getCanonicalOrigin(), "https://pjsk.moe", "invalid configured origins fail closed");
    process.env.NEXT_PUBLIC_SITE_DOMAIN = "http://pjsk.moe";
    assert.equal(origins.getCanonicalOrigin(), "https://pjsk.moe", "production canonicals require HTTPS");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  const proxy = readWeb("src/proxy.ts");
  const sitemap = readWeb("src/lib/sitemap.ts");
  assert.doesNotMatch(proxy, /x-forwarded-(?:host|proto)/i);
  assert.doesNotMatch(sitemap, /next\/headers|headers\(\)|get\(['"]host['"]\)/);
  assert.match(sitemap, /return getCanonicalOrigin\(\)/);
});
