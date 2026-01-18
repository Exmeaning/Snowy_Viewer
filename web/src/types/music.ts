// Music Types for Snowy Viewer
// Based on sekai.best and sekaimaster data structure

export type MusicCategoryType = "mv" | "mv_2d" | "original" | "image";

export type MusicTagType =
    | "all"
    | "vocaloid"
    | "theme_park"
    | "street"
    | "idol"
    | "school_refusal"
    | "light_music_club"
    | "other";

export interface IMusicInfo {
    id: number;
    seq: number;
    releaseConditionId: number;
    categories: MusicCategoryType[];
    title: string;
    pronunciation: string;
    creatorArtistId: number;
    lyricist: string;
    composer: string;
    arranger: string;
    dancerCount: number;
    selfDancerPosition: number;
    assetbundleName: string;
    liveTalkBackgroundAssetbundleName: string;
    publishedAt: number;
    releasedAt: number;
    liveStageId: number;
    fillerSec: number;
    isNewlyWrittenMusic: boolean;
    isFullLength: boolean;
}

export interface IMusicTagInfo {
    id: number;
    musicId: number;
    musicTag: MusicTagType;
    seq: number;
}

export interface IMusicVocalInfo {
    id: number;
    musicId: number;
    musicVocalType: string;
    seq: number;
    releaseConditionId: number;
    caption: string;
    characters: IMusicVocalCharacter[];
    assetbundleName: string;
    archiveDisplayType: string;
    archivePublishedAt: number;
}

export interface IMusicVocalCharacter {
    id: number;
    musicVocalId: number;
    characterType: "game_character" | "outside_character";
    characterId: number;
    seq: number;
}

// Music tag display names (Chinese)
export const MUSIC_TAG_NAMES: Record<MusicTagType, string> = {
    all: "全部",
    vocaloid: "VIRTUAL SINGER",
    light_music_club: "Leo/need",
    idol: "MORE MORE JUMP!",
    street: "Vivid BAD SQUAD",
    theme_park: "Wonderlands×Showtime",
    school_refusal: "25時、ナイトコードで。",
    other: "其他",
};

// Music category display names (Chinese)
export const MUSIC_CATEGORY_NAMES: Record<MusicCategoryType, string> = {
    mv: "3D MV",
    mv_2d: "2D MV",
    original: "原创MV",
    image: "静态图片",
};

// Music category colors
export const MUSIC_CATEGORY_COLORS: Record<MusicCategoryType, string> = {
    mv: "#4488DD",
    mv_2d: "#44BB88",
    original: "#FF9900",
    image: "#888888",
};

// Music difficulty type
export type MusicDifficultyType = "easy" | "normal" | "hard" | "expert" | "master" | "append";

export interface IMusicDifficultyInfo {
    id: number;
    musicId: number;
    musicDifficulty: MusicDifficultyType;
    playLevel: number;
    totalNoteCount: number;
}

// Difficulty display names
export const DIFFICULTY_NAMES: Record<MusicDifficultyType, string> = {
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
    expert: "EXPERT",
    master: "MASTER",
    append: "APPEND",
};

// Difficulty colors
export const DIFFICULTY_COLORS: Record<MusicDifficultyType, string> = {
    easy: "#5AC06E",
    normal: "#56A4D4",
    hard: "#EFAF28",
    expert: "#E84D53",
    master: "#BB58B8",
    append: "#EE92BC",
};

// Music Meta interface for external API data
export interface IMusicMeta {
    music_id: number;
    difficulty: string;
    music_time: number;
    event_rate: number;
    base_score: number;
    fever_score: number;
    cycles_auto: number;
    cycles_multi: number;
    pspi_auto_score: number;
    pspi_solo_score: number;
    pspi_multi_score: number;
    pspi_auto_pt_max: number;
    pspi_solo_pt_max: number;
    pspi_multi_pt_max: number;
    pspi_pt_per_hour_auto: number;
    pspi_pt_per_hour_multi: number;
}

// Ranking info for display in music items
export interface IRankingInfo {
    rank: number;
    total: number;
}

// Re-export asset URL functions from centralized assets.ts
export { getChartSvgUrl, getMusicJacketUrl, getMusicVocalAudioUrl } from "@/lib/assets";


