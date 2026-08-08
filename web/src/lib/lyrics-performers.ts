export interface ExternalLyricsPerformer {
    id: number;
    sourceId: string;
    name: string;
    color: string;
    avatarUrl: string;
}

// Reserved lyrics-only IDs are intentionally outside the Project SEKAI
// gameCharacters range. They are stable across the producer and consumer and
// represent the six external Sekaipedia singer identities actually encountered
// in the reviewed 698-song catalog, not fabricated game-character IDs.
export const EXTERNAL_LYRICS_PERFORMERS = [
    { id: 1001, sourceId: "外部歌唱者-01", name: "GUMI", color: "#70B85A", avatarUrl: "/images/lyrics-performers/gumi.webp" },
    { id: 1007, sourceId: "外部歌唱者-07", name: "KAFU", color: "#8A8A91", avatarUrl: "/images/lyrics-performers/kafu.webp" },
    { id: 1009, sourceId: "外部歌唱者-09", name: "SEKAI", color: "#4A89A8", avatarUrl: "/images/lyrics-performers/sekai.webp" },
    { id: 1011, sourceId: "外部歌唱者-11", name: "Zundamon", color: "#78AF54", avatarUrl: "/images/lyrics-performers/zundamon.webp" },
    { id: 1018, sourceId: "外部歌唱者-18", name: "Kotonoha Aoi", color: "#4D8FCC", avatarUrl: "/images/lyrics-performers/kotonoha-aoi.webp" },
    { id: 1019, sourceId: "外部歌唱者-19", name: "Kotonoha Akane", color: "#D75C58", avatarUrl: "/images/lyrics-performers/kotonoha-akane.webp" },
] as const satisfies readonly ExternalLyricsPerformer[];

const EXTERNAL_LYRICS_PERFORMER_BY_ID = new Map<number, ExternalLyricsPerformer>(
    EXTERNAL_LYRICS_PERFORMERS.map((performer) => [performer.id, performer]),
);
const EXTERNAL_LYRICS_PERFORMER_BY_SOURCE_ID = new Map<string, ExternalLyricsPerformer>(
    EXTERNAL_LYRICS_PERFORMERS.map((performer) => [performer.sourceId, performer]),
);

export function getExternalLyricsPerformer(id: number): ExternalLyricsPerformer | null {
    return EXTERNAL_LYRICS_PERFORMER_BY_ID.get(id) ?? null;
}

export function getExternalLyricsPerformerBySourceId(sourceId: string): ExternalLyricsPerformer | null {
    return EXTERNAL_LYRICS_PERFORMER_BY_SOURCE_ID.get(sourceId) ?? null;
}

export function getLyricsCharacterIdBySourceId(sourceId: string): number | null {
    const match = /^歌唱者-(\d+)$/.exec(sourceId);
    if (!match) return null;
    const characterId = Number(match[1]);
    return Number.isSafeInteger(characterId) && characterId >= 1 && characterId <= 26 ? characterId : null;
}
