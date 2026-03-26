/**
 * Service Worker for Snowy Viewer
 * Caches image assets (card thumbnails, event banners, music jackets, etc.)
 * using a Cache First strategy for optimal performance.
 */

const CACHE_NAME = "snowy-assets-v1";

// Max cache size (number of entries). Prevents unbounded growth.
const MAX_CACHE_ENTRIES = 2000;

// Asset domains to cache
const CACHEABLE_DOMAINS = [
    "assets.exmeaning.com",
    "assets.unipjsk.com",
    "sekai-assets-bdf29c81.seiunx.net",
    "snowyassets.exmeaning.com",
];

// File extensions to cache
const CACHEABLE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

/**
 * Check if a request URL should be cached
 */
function shouldCache(url) {
    try {
        const parsed = new URL(url);
        // Must be from a known asset domain
        if (!CACHEABLE_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith("." + d))) {
            return false;
        }
        // Must be an image file
        const path = parsed.pathname.toLowerCase();
        return CACHEABLE_EXTENSIONS.some((ext) => path.endsWith(ext));
    } catch {
        return false;
    }
}

/**
 * Trim cache to MAX_CACHE_ENTRIES (evict oldest first)
 */
async function trimCache(cache) {
    const keys = await cache.keys();
    if (keys.length > MAX_CACHE_ENTRIES) {
        // Delete oldest entries (first in list)
        const toDelete = keys.length - MAX_CACHE_ENTRIES;
        for (let i = 0; i < toDelete; i++) {
            await cache.delete(keys[i]);
        }
    }
}

// Install: just activate immediately
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

// Activate: claim clients and clean up old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            await self.clients.claim();
            // Clean up old cache versions
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                if (name !== CACHE_NAME && name.startsWith("snowy-assets")) {
                    await caches.delete(name);
                }
            }
        })()
    );
});

// Fetch: Cache First for matching asset requests
self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Only handle GET requests for cacheable assets
    if (request.method !== "GET" || !shouldCache(request.url)) {
        return;
    }

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // 1. Try cache first
            const cached = await cache.match(request);
            if (cached) {
                return cached;
            }

            // 2. Not in cache, fetch from network
            try {
                const response = await fetch(request);

                // Only cache successful responses
                if (response.ok) {
                    // Clone before consuming
                    cache.put(request, response.clone()).then(() => trimCache(cache));
                }

                return response;
            } catch (error) {
                // Network failed and no cache — return a transparent 1x1 pixel as fallback
                return new Response(
                    new Uint8Array([
                        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
                        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
                        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
                        0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
                        0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
                    ]),
                    {
                        status: 200,
                        headers: { "Content-Type": "image/png" },
                    }
                );
            }
        })()
    );
});

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
    if (event.data === "clear-asset-cache") {
        caches.delete(CACHE_NAME).then(() => {
            console.log("[SW] Asset cache cleared");
        });
    }
});
