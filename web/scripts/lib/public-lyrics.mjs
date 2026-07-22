import { fetchJsonWithFallback } from './build-fetch.mjs';

const DEFAULT_PUBLIC_LYRICS_INDEX_URL = 'https://translation.exmeaning.com/files/translation/lyrics/index.json';

function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
    const allowed = new Set(keys);
    return Object.keys(value).every(key => allowed.has(key));
}

function isDateTime(value) {
    return typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && !Number.isNaN(Date.parse(value));
}

function isTitle(value) {
    return isObject(value)
        && hasOnlyKeys(value, ['ja-JP', 'zh-CN', 'en-US'])
        && typeof value['ja-JP'] === 'string'
        && (value['zh-CN'] === undefined || typeof value['zh-CN'] === 'string')
        && (value['en-US'] === undefined || typeof value['en-US'] === 'string');
}

export function validatePublicLyricsIndex(value) {
    if (!isObject(value) || !hasOnlyKeys(value, ['version', 'songs']) || value.version !== 1 || !Array.isArray(value.songs)) {
        throw new Error('Invalid public lyrics index');
    }

    const musicIds = new Set();
    for (const song of value.songs) {
        if (
            !isObject(song)
            || !hasOnlyKeys(song, ['musicId', 'revision', 'updatedAt', 'title'])
            || !Number.isInteger(song.musicId)
            || song.musicId < 1
            || !Number.isInteger(song.revision)
            || song.revision < 1
            || !isDateTime(song.updatedAt)
            || !isTitle(song.title)
            || musicIds.has(song.musicId)
        ) {
            throw new Error('Invalid public lyrics index');
        }
        musicIds.add(song.musicId);
    }
    return value;
}

export function getConfiguredPublicLyricsIndexUrls() {
    const configured = String(process.env.PUBLIC_LYRICS_INDEX_URLS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    return configured.length > 0 ? [...new Set(configured)] : [DEFAULT_PUBLIC_LYRICS_INDEX_URL];
}

export async function fetchPublicLyricsIndex() {
    const index = await fetchJsonWithFallback(
        'public lyrics index',
        getConfiguredPublicLyricsIndexUrls(),
    );
    return validatePublicLyricsIndex(index);
}
