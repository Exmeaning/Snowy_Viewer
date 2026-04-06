const HARUKI_PUBLIC_API_BASE = "https://suite-api.haruki.seiunx.com/public";
const HARUKI_PUBLIC_API_PROXY_BASE = "/api/haruki-public";
const LOCAL_PROXY_HOSTS = new Set(["localhost", "127.0.0.1"]);

function getCurrentHostname(): string | null {
    if (typeof globalThis === "undefined") return null;
    const location = (globalThis as { location?: Location }).location;
    return typeof location?.hostname === "string" ? location.hostname : null;
}

export function shouldUseHarukiPublicApiProxy(): boolean {
    const hostname = getCurrentHostname();
    return hostname !== null && LOCAL_PROXY_HOSTS.has(hostname);
}

export function getHarukiPublicApiBase(): string {
    return shouldUseHarukiPublicApiProxy()
        ? HARUKI_PUBLIC_API_PROXY_BASE
        : HARUKI_PUBLIC_API_BASE;
}
