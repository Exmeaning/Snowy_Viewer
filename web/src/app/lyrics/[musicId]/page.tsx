import { notFound } from "next/navigation";

import { fetchLyricsDocument, isLyricsUnavailableError } from "@/lib/lyrics";
import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";
import { createDetailFallbackMetadata } from "@/lib/seo-metadata";
import LyricsDetailClient from "./client";

interface LyricsDetailPageProps {
    params: Promise<{ musicId: string }>;
}

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

export async function generateMetadata({ params }: LyricsDetailPageProps) {
    const { musicId } = await params;
    const numericId = Number(musicId);
    if (!await hasAvailableLyrics(numericId)) {
        return createDetailFallbackMetadata("lyrics", `/lyrics/${musicId}`, "summary");
    }

    return Page.generateMetadata({ params: Promise.resolve({ id: musicId }) });
}

export default async function LyricsDetailPage({ params }: LyricsDetailPageProps) {
    const { musicId } = await params;
    if (!await hasAvailableLyrics(Number(musicId))) notFound();
    return <Page params={Promise.resolve({ id: musicId })} />;
}
