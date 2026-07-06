import fs from 'fs';

const DEFAULT_MASTER_DATA_URLS = [
    'https://metadata.exmeaning.com/jp/master',
    'https://metadata.pjsk.moe/jp/master',
];

const DEFAULT_MANGA_DATA_URLS = [
    'https://moe.exmeaning.com/mangas/mangas.json',
];

const DEFAULT_GUIDES_DATA_URLS = [
    'https://moe.exmeaning.com/guides/guides-index.json',
];

function splitUrlList(value) {
    return String(value || '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
}

function normalizeBaseUrl(url) {
    return url.replace(/\/+$/, '');
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

export function getConfiguredMasterDataUrls() {
    const explicitList = splitUrlList(process.env.MASTER_DATA_URLS);
    if (explicitList.length > 0) {
        return unique(explicitList.map(normalizeBaseUrl));
    }

    const singleUrl = process.env.MASTER_DATA_URL ? [process.env.MASTER_DATA_URL] : [];
    return unique([...singleUrl, ...DEFAULT_MASTER_DATA_URLS].map(normalizeBaseUrl));
}

export function getConfiguredMangaDataUrls() {
    const explicitList = splitUrlList(process.env.MANGA_DATA_URLS);
    if (explicitList.length > 0) {
        return unique(explicitList);
    }

    const singleUrl = process.env.MANGA_DATA_URL ? [process.env.MANGA_DATA_URL] : [];
    return unique([...singleUrl, ...DEFAULT_MANGA_DATA_URLS]);
}

export function getConfiguredGuidesDataUrls() {
    const explicitList = splitUrlList(process.env.GUIDES_DATA_URLS);
    if (explicitList.length > 0) {
        return unique(explicitList);
    }

    const singleUrl = process.env.GUIDES_DATA_URL ? [process.env.GUIDES_DATA_URL] : [];
    return unique([...singleUrl, ...DEFAULT_GUIDES_DATA_URLS]);
}

export function getBuildFetchConcurrency(defaultValue = 3) {
    const raw = Number.parseInt(process.env.BUILD_FETCH_CONCURRENCY || '', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : defaultValue;
}

export function requireFreshBuildData() {
    return /^(1|true|yes)$/i.test(process.env.REQUIRE_FRESH_BUILD_DATA || '');
}

function getFetchTimeoutMs() {
    const raw = Number.parseInt(process.env.BUILD_FETCH_TIMEOUT_MS || '', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 15000;
}

function getFetchRetries() {
    const raw = Number.parseInt(process.env.BUILD_FETCH_RETRIES || '', 10);
    return Number.isFinite(raw) && raw >= 0 ? raw : 2;
}

function describeError(error) {
    const parts = [];
    if (error?.name) parts.push(error.name);
    if (error?.message) parts.push(error.message);
    if (error?.cause?.code) parts.push(`code=${error.cause.code}`);
    if (error?.cause?.errno) parts.push(`errno=${error.cause.errno}`);
    return parts.join(': ') || String(error);
}

function joinUrl(baseUrl, pathname) {
    const base = normalizeBaseUrl(baseUrl);
    const path = String(pathname || '').replace(/^\/+/, '');
    return `${base}/${path}`;
}

async function delay(ms) {
    if (ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetch a JSON resource from multiple URLs with retry/fallback.
 */
export async function fetchJsonWithFallback(label, urls, options = {}) {
    const timeoutMs = options.timeoutMs ?? getFetchTimeoutMs();
    const retries = options.retries ?? getFetchRetries();
    const retryDelayMs = options.retryDelayMs ?? 250;
    const allErrors = [];

    for (const url of unique(urls)) {
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                const data = await fetchJson(url, timeoutMs);
                const size = JSON.stringify(data).length;
                console.log(`    ✓ ${label} from ${url} (${(size / 1024 / 1024).toFixed(2)} MB raw)`);
                return data;
            } catch (error) {
                const message = describeError(error);
                allErrors.push(`${url} attempt ${attempt + 1}/${retries + 1}: ${message}`);

                if (attempt < retries) {
                    console.warn(`    ↻ ${label} retry ${attempt + 1}/${retries} from ${url}: ${message}`);
                    await delay(retryDelayMs * (attempt + 1));
                    continue;
                }

                console.warn(`    ⚠ ${label} failed from ${url}: ${message}`);
            }
        }
    }

    throw new Error(`Failed to fetch ${label} from all sources. ${allErrors.join(' | ')}`);
}

export async function fetchMasterJson(filename, label = filename, options = {}) {
    const urls = getConfiguredMasterDataUrls().map(baseUrl => joinUrl(baseUrl, filename));
    return fetchJsonWithFallback(label, urls, options);
}

export async function fetchMangaJson(label = 'mangas', options = {}) {
    return fetchJsonWithFallback(label, getConfiguredMangaDataUrls(), options);
}

export async function fetchGuidesJson(label = 'guides', options = {}) {
    return fetchJsonWithFallback(label, getConfiguredGuidesDataUrls(), options);
}

export function readJsonIfExists(filePath, fallback = null) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.warn(`    ⚠ Failed to read existing ${filePath}: ${describeError(error)}`);
        return fallback;
    }
}

export async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex;
                nextIndex += 1;
                results[currentIndex] = await mapper(items[currentIndex], currentIndex);
            }
        })
    );

    return results;
}
