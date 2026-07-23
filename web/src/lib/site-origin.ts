const DEFAULT_SITE_ORIGIN = "https://pjsk.moe";

function parseHttpOrigin(value: string | undefined): URL | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        if (
            (url.protocol !== "http:" && url.protocol !== "https:")
            || url.username
            || url.password
            || url.pathname !== "/"
            || url.search
            || url.hash
        ) {
            return null;
        }
        return url;
    } catch {
        return null;
    }
}

export function getCanonicalOrigin(): string {
    const configured = parseHttpOrigin(process.env.NEXT_PUBLIC_SITE_DOMAIN);
    if (configured && (process.env.NODE_ENV !== "production" || configured.protocol === "https:")) {
        return configured.origin;
    }
    return DEFAULT_SITE_ORIGIN;
}

export function isAllowedPublicHost(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
    if (!normalized) return false;

    const configuredHosts = (process.env.PUBLIC_HOST_ALLOWLIST ?? "")
        .split(",")
        .map((host) => host.trim().toLowerCase().replace(/\.$/, ""))
        .filter(Boolean);
    const canonicalHostname = new URL(getCanonicalOrigin()).hostname.toLowerCase();
    if (normalized === canonicalHostname || configuredHosts.includes(normalized)) return true;

    return process.env.NODE_ENV !== "production" && (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1");
}

export function getPublicRequestOrigin(candidate: string): string {
    const parsed = parseHttpOrigin(candidate);
    if (!parsed || !isAllowedPublicHost(parsed.hostname)) return getCanonicalOrigin();

    // Production redirects always consolidate on the configured canonical
    // origin rather than reflecting a proxy-controlled scheme or port.
    return process.env.NODE_ENV === "production" ? getCanonicalOrigin() : parsed.origin;
}
