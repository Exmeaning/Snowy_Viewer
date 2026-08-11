import { fetchMasterData, fetchMasterDataForServer } from "@/lib/fetch";
import {
    findLyricsMusic,
    mergePublishedLyricsMusicCatalog,
    normalizeLyricsMusic,
} from "@/lib/lyrics-music-catalog";
import type { IMusicInfo } from "@/types/music";

async function fetchCurrentRegionMusics(): Promise<IMusicInfo[]> {
    return fetchMasterData<IMusicInfo[]>("musics.json");
}

async function fetchJapaneseMusics(): Promise<IMusicInfo[]> {
    return fetchMasterDataForServer<IMusicInfo[]>("jp", "musics.json");
}

export async function fetchLyricsMusicCatalog(publishedMusicIds: ReadonlySet<number>): Promise<IMusicInfo[]> {
    const currentRegionMusics = await fetchCurrentRegionMusics();
    const currentRegionIds = new Set(currentRegionMusics.map((music) => music.id));
    if ([...publishedMusicIds].every((musicId) => currentRegionIds.has(musicId))) {
        return currentRegionMusics.map(normalizeLyricsMusic);
    }

    try {
        const japaneseMusics = await fetchJapaneseMusics();
        return mergePublishedLyricsMusicCatalog(currentRegionMusics, japaneseMusics, publishedMusicIds);
    } catch {
        return currentRegionMusics.map(normalizeLyricsMusic);
    }
}

export async function fetchLyricsMusicById(musicId: number): Promise<IMusicInfo | null> {
    const currentRegionMusics = await fetchCurrentRegionMusics();
    const currentRegionMusic = findLyricsMusic(musicId, currentRegionMusics);
    if (currentRegionMusic) return currentRegionMusic;

    try {
        return findLyricsMusic(musicId, [], await fetchJapaneseMusics());
    } catch {
        return null;
    }
}
