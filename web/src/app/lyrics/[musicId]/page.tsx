import { notFound } from "next/navigation";

import { fetchLyricsDocument, isLyricsUnavailableError } from "@/lib/lyrics";
import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";
import LyricsDetailClient from "./client";

const Page = defineLyricsDetailClientPage(LyricsDetailClient);

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
    if (!await hasAvailableLyrics(Number(musicId))) notFound();
    return <Page params={Promise.resolve({ id: musicId })} />;
}
