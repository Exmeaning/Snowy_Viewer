import { notFound } from "next/navigation";

import { fetchLyricsDocument, isLyricsUnavailableError } from "@/lib/lyrics";
import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";
import LyricsDetailClient from "./client";

const Page = defineLyricsDetailClientPage(LyricsDetailClient);

function parseCanonicalMusicId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const musicId = Number(value);
    return Number.isSafeInteger(musicId) ? musicId : null;
}

async function hasAvailableLyrics(musicId: number): Promise<boolean> {
    if (!Number.isInteger(musicId) || musicId <= 0) return false;
    try {
        await fetchLyricsDocument(musicId);
        return true;
    } catch (error) {
        if (isLyricsUnavailableError(error)) return false;
        throw error;
    }
}

export default async function LyricsDetailPage({ params }: { params: Promise<{ musicId: string }> }) {
    const { musicId } = await params;
    const canonicalMusicId = parseCanonicalMusicId(musicId);
    if (canonicalMusicId === null || !await hasAvailableLyrics(canonicalMusicId)) notFound();
    return <Page params={Promise.resolve({ id: String(canonicalMusicId) })} />;
}
