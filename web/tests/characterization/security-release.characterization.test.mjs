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
  const workflowDir = path.join(REPO_ROOT, ".github/workflows");
  const workflowFiles = fs.readdirSync(workflowDir).filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));
  for (const workflowFile of workflowFiles) {
    const source = readRepo(`.github/workflows/${workflowFile}`);
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
  assert.match(ci, /calculator:[\s\S]*npm test -- --runInBand[\s\S]*npm run build[\s\S]*npm audit --omit=dev --audit-level=high[\s\S]*npm audit --audit-level=critical/);
  assert.match(ci, /Validate synthetic HTTPS fixture behavior[\s\S]*node --test scripts\/serve-public-lyrics-build-contract\.test\.mjs/);
  assert.match(ci, /Validate production image build contract[\s\S]*serve-public-lyrics-build-contract\.mjs/);
  assert.match(ci, /cleanup\(\)[\s\S]*kill -KILL "\$fixture_pid"[\s\S]*docker buildx rm --force "\$builder_name"/);
  assert.match(ci, /curl --fail --silent --show-error[\s\S]*--connect-timeout 3[\s\S]*--max-time 10/);
  assert.match(ci, /openssl req -x509[\s\S]*subjectAltName=DNS:host\.docker\.internal,DNS:localhost,IP:127\.0\.0\.1/);
  assert.match(ci, /serve-public-lyrics-build-contract\.mjs[\s\S]*--host 0\.0\.0\.0/);
  assert.match(ci, /lyrics_base_url="https:\/\/localhost:\$\{fixture_port\}\/files\/translation\/lyrics"/);
  assert.match(ci, /value\.version !== 4[\s\S]*song\?\.availableVersions\?\.join\(","\) !== "full"/);
  assert.match(ci, /docker buildx create[\s\S]*--driver docker-container[\s\S]*--driver-opt network=host[\s\S]*--use/);
  assert.match(ci, /docker buildx build[\s\S]*--allow network\.host[\s\S]*--network host[\s\S]*--secret id=public_lyrics_ca,src="\$fixture_dir\/cert\.pem"/);
  assert.doesNotMatch(ci, /host-gateway/);
  assert.match(ci, /--build-arg NEXT_PUBLIC_LYRICS_BASE_URL="\$lyrics_base_url"[\s\S]*--load/);
  assert.doesNotMatch(ci, /vars\.NEXT_PUBLIC_LYRICS_BASE_URL/);
  assert.doesNotMatch(ci, /NEXT_PUBLIC_LYRICS_BASE_URL:\s*https?:\/\//);
  const watchMasterData = readRepo(".github/workflows/watch-master-data.yml");
  assert.match(watchMasterData, /Update Master Data Version/);
  assert.match(watchMasterData, /data\/master_version\.txt/);
  assert.doesNotMatch(watchMasterData, /npm run sitemap/);
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
  assert.equal(
    production.match(/^ARG NEXT_PUBLIC_LYRICS_BASE_URL=https:\/\/translation\.exmeaning\.com\/files\/translation\/lyrics$/gm)?.length,
    2,
  );
  assert.doesNotMatch(production, /^ARG NEXT_PUBLIC_LYRICS_BASE_URL$/m);
  assert.match(production, /ENV NODE_ENV=production[\s\S]*bun run sitemap/);
  assert.match(production, /ENV NEXT_PUBLIC_LYRICS_BASE_URL=\$NEXT_PUBLIC_LYRICS_BASE_URL/);
  assert.match(production, /RUN test -n "\$NEXT_PUBLIC_LYRICS_BASE_URL"/);
  assert.match(production, /RUN printf '%s\\n' "\$NEXT_PUBLIC_LYRICS_BASE_URL" > \/app\/public-lyrics-base-url-build-contract/);
  assert.match(production, /COPY --from=builder-web[\s\S]*public-lyrics-base-url-build-contract/);
  assert.match(production, /export REQUIRE_PUBLIC_LYRICS_SOURCE=1;[\s\S]*bun run sitemap/);
  const productionWithoutReviewedLyricsDefault = production.replaceAll(
    "ARG NEXT_PUBLIC_LYRICS_BASE_URL=https://translation.exmeaning.com/files/translation/lyrics",
    "ARG NEXT_PUBLIC_LYRICS_BASE_URL=<reviewed-public-lyrics-base>",
  );
  assert.doesNotMatch(productionWithoutReviewedLyricsDefault, /NEXT_PUBLIC_LYRICS_BASE_URL=.*(?:https?:\/\/|token|password|@)/i);
  const lyricsBaseUrl = readRepo("web/src/lib/public-lyrics-base-url.mjs");
  assert.match(lyricsBaseUrl, /export const DEFAULT_PUBLIC_LYRICS_BASE_URL = "https:\/\/translation\.exmeaning\.com\/files\/translation\/lyrics";/);
  assert.match(readRepo("web/src/lib/lyrics.ts"), /from "@\/lib\/public-lyrics-base-url\.mjs"/);
  assert.match(readRepo("web/scripts/lib/public-lyrics.mjs"), /from '\.\.\/\.\.\/src\/lib\/public-lyrics-base-url\.mjs'/);
  const startContainer = readRepo("scripts/start-container.sh");
  assert.match(startContainer, /public-lyrics-base-url-build-contract/);
  assert.match(startContainer, /NEXT_PUBLIC_LYRICS_BASE_URL="\$BUILT_PUBLIC_LYRICS_BASE_URL"/);
  assert.match(startContainer, /does not match the build-time public lyrics source/);
  assert.doesNotMatch(startContainer, /is not configured at runtime/);
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
  assert.doesNotMatch(client, /AnalyticsConsentControl|controls\.consent/);
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
  const oauth = await importWebTypeScript("src/lib/oauth.ts", [
    [
      'import { normalizeServer, type ServerType } from "./account-servers";',
      'const normalizeServer = (value) => (typeof value === "string" && ["cn", "jp", "tw", "kr", "en"].includes(value.trim().toLowerCase()) ? value.trim().toLowerCase() : null);\ntype ServerType = "cn" | "jp" | "tw" | "kr" | "en";',
    ],
    [
      'import { localizePathForBrowser } from "@/lib/localized-path";',
      "const localizePathForBrowser = (value) => value;",
    ],
  ]);

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

test("staff links are whitelisted in ExternalLink and team translation members are consistent across locales", async () => {
  const teamLinks = await importWebTypeScript("src/lib/team-links.ts");
  assert.equal(teamLinks.MEMBER_LINKS["@御明正"], "https://space.bilibili.com/10820191");
  assert.equal(teamLinks.MEMBER_LINKS["御明正"], "https://space.bilibili.com/10820191");

  const externalLinkSource = readWeb("src/components/ExternalLink.tsx");
  assert.match(externalLinkSource, /import\s*\{[^}]*MEMBER_LINKS[^}]*\}\s*from\s*["']@\/lib\/team-links["']/);
  assert.match(externalLinkSource, /Object\.values\(MEMBER_LINKS\)/);

  const zhCN = readWeb("src/lib/i18n/messages/zh-CN/index.ts");
  const zhTW = readWeb("src/lib/i18n/messages/zh-TW/page-primary.ts");
  const enUS = readWeb("src/lib/i18n/messages/en-US/index.ts");
  const jaJP = readWeb("src/lib/i18n/messages/ja-JP/index.ts");
  const koKR = readWeb("src/lib/i18n/messages/ko-KR/index.ts");

  for (const [sourceName, sourceContent] of [
    ["zh-CN", zhCN],
    ["zh-TW", zhTW],
    ["en-US", enUS],
    ["ja-JP", jaJP],
    ["ko-KR", koKR],
  ]) {
    assert.doesNotMatch(sourceContent, /translationMembers:\s*["'](?:翻译\/校对|翻譯\/校對|Translation \/ proofreading:|번역\/교정)/, `${sourceName} should not have role prefix in translationMembers`);
    assert.match(sourceContent, /translationMembers:.*@御明正/, `${sourceName} must include @御明正`);
  }
});
