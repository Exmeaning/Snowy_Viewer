import type { IMusicInfo, MusicCategoryType } from "@/types/music";

type RawMusicCategory = MusicCategoryType | { musicCategoryName: MusicCategoryType };

export function normalizeLyricsMusic(music: IMusicInfo): IMusicInfo {
    return {
        ...music,
        categories: ((music.categories ?? []) as unknown as RawMusicCategory[]).map((category) =>
            typeof category === "object" && category !== null && "musicCategoryName" in category
                ? category.musicCategoryName
                : category
        ),
    };
}

export function findLyricsMusic(
    musicId: number,
    currentRegionMusics: readonly IMusicInfo[],
    japaneseMusics: readonly IMusicInfo[] = [],
): IMusicInfo | null {
    const music = currentRegionMusics.find((item) => item.id === musicId)
        ?? japaneseMusics.find((item) => item.id === musicId)
        ?? null;
    return music ? normalizeLyricsMusic(music) : null;
}

export function mergePublishedLyricsMusicCatalog(
    currentRegionMusics: readonly IMusicInfo[],
    japaneseMusics: readonly IMusicInfo[],
    publishedMusicIds: ReadonlySet<number>,
): IMusicInfo[] {
    const merged = currentRegionMusics.map(normalizeLyricsMusic);
    const existingIds = new Set(merged.map((music) => music.id));
    for (const music of japaneseMusics) {
        if (!publishedMusicIds.has(music.id) || existingIds.has(music.id)) continue;
        merged.push(normalizeLyricsMusic(music));
        existingIds.add(music.id);
    }
    return merged;
}
