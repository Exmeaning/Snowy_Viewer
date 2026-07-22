import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROUTE_LOCALES = ["zh-cn", "zh-tw", "ja-jp", "en-us", "ko-kr"];
const LOCALIZED_HREF_PATTERN = new RegExp(`^/(?:${ROUTE_LOCALES.join("|")})(?:/|$)`, "i");
const START_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(scriptDirectory, "..");
const serverCandidates = [
    path.join(webDirectory, ".next", "standalone", "web", "server.js"),
    path.join(webDirectory, ".next", "standalone", "server.js"),
];
const serverPath = serverCandidates.find(existsSync);

assert(serverPath, "Standalone server not found. Run `npm run build:next` first.");

function reservePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            assert(address && typeof address === "object");
            const { port } = address;
            server.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

function extractLocalizedHrefs(html) {
    const hrefs = [];
    const anchorPattern = /<a\b[^>]*\bhref="([^"]+)"/gi;
    for (const match of html.matchAll(anchorPattern)) {
        if (LOCALIZED_HREF_PATTERN.test(match[1])) hrefs.push(match[1]);
    }
    return hrefs;
}

async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(response.status, 200, `${url} returned HTTP ${response.status}`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    return response.text();
}

async function waitForServer(baseUrl, child) {
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
        assert.equal(child.exitCode, null, "Standalone server exited before becoming ready.");
        try {
            await fetchHtml(`${baseUrl}/zh-cn/`);
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
    throw new Error(`Standalone server did not become ready within ${START_TIMEOUT_MS}ms.`);
}

async function stopServer(child) {
    if (child.exitCode !== null) return;
    child.kill();
    await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
}

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
let serverOutput = "";
const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
        ...process.env,
        HOSTNAME: "127.0.0.1",
        PORT: String(port),
        NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => { serverOutput += chunk; });
child.stderr.on("data", (chunk) => { serverOutput += chunk; });

try {
    await waitForServer(baseUrl, child);

    for (const routeLocale of ROUTE_LOCALES) {
        const html = await fetchHtml(`${baseUrl}/${routeLocale}/`);
        const hrefs = extractLocalizedHrefs(html);
        const expectedPrefix = `/${routeLocale}/`;
        const wrongLocaleHrefs = hrefs.filter((href) => !href.toLowerCase().startsWith(expectedPrefix));
        const paths = hrefs.map((href) => new URL(href, baseUrl).pathname.toLowerCase());

        assert(hrefs.length > 0, `No localized SSR links found for ${routeLocale}.`);
        assert.deepEqual(
            wrongLocaleHrefs,
            [],
            `${routeLocale} SSR contains links for another route locale: ${wrongLocaleHrefs.slice(0, 5).join(", ")}`,
        );
        assert(
            paths.includes(`${expectedPrefix}materials/`),
            `${routeLocale} SSR is missing ${expectedPrefix}materials/`,
        );

        console.log(`${routeLocale}: ${hrefs.length} localized SSR links preserve the route locale`);
    }
} catch (error) {
    if (serverOutput.trim()) console.error(serverOutput.trim());
    throw error;
} finally {
    await stopServer(child);
}
