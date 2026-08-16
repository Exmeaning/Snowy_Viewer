import { notFound } from "next/navigation";

import { fetchLyricsDocument, getPublishedLyricsIndexEntry, isLyricsUnavailableError } from "@/lib/lyrics";
import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";
import { fetchLyricsMusicById } from "@/lib/lyrics-music-source";
import LyricsDetailClient from "./client";

const Page = defineLyricsDetailClientPage(LyricsDetailClient);

function parseCanonicalMusicId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const musicId = Number(value);
    return Number.isSafeInteger(musicId) ? musicId : null;
}

type LyricsDetailMode = "detail" | "draft" | "not-found";

async function resolveLyricsDetailMode(musicId: number): Promise<LyricsDetailMode> {
    if (!Number.isInteger(musicId) || musicId <= 0) return "not-found";
    let publication = null;
    try {
        publication = await getPublishedLyricsIndexEntry(musicId);
    } catch {
        // A temporarily unavailable index must not 404 published songs.
        // Trade-off: reviewed instrumentals may render as drafts during an outage.
        publication = null;
    }
    try {
        await fetchLyricsDocument(musicId);
        return "detail";
    } catch (error) {
        if (!isLyricsUnavailableError(error)) throw error;
        if (publication?.state === "satisfied_no_lyrics") return "not-found";
        try {
            const music = await fetchLyricsMusicById(musicId);
            return music ? "draft" : "not-found";
        } catch {
            // A masterdata outage degrades the draft gate to not-found instead of
            // failing the whole lyrics route; the client retries the same lookup.
            return "not-found";
        }
    }
}

export default async function LyricsDetailPage({ params }: { params: Promise<{ musicId: string }> }) {
    const { musicId } = await params;
    const canonicalMusicId = parseCanonicalMusicId(musicId);
    if (canonicalMusicId === null) notFound();
    const mode = await resolveLyricsDetailMode(canonicalMusicId);
    if (mode === "not-found") notFound();
    return <Page params={Promise.resolve({ id: String(canonicalMusicId) })} />;
}
