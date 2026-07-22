import { notFound } from "next/navigation";

import { getPublishedLyricsIndexEntry } from "@/lib/lyrics";
import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";
import { createDetailFallbackMetadata } from "@/lib/seo-metadata";
import LyricsDetailClient from "./client";

interface LyricsDetailPageProps {
    params: Promise<{ musicId: string }>;
}

const Page = defineLyricsDetailClientPage(LyricsDetailClient);

export async function generateMetadata({ params }: LyricsDetailPageProps) {
    const { musicId } = await params;
    const numericId = Number(musicId);
    const publication = await getPublishedLyricsIndexEntry(numericId);
    if (!publication) {
        return createDetailFallbackMetadata("lyrics", `/lyrics/${musicId}`, "summary");
    }

    return Page.generateMetadata({ params: Promise.resolve({ id: musicId }) });
}

export default async function LyricsDetailPage({ params }: LyricsDetailPageProps) {
    const { musicId } = await params;
    const publication = await getPublishedLyricsIndexEntry(Number(musicId));
    if (!publication) notFound();
    return <Page params={Promise.resolve({ id: musicId })} />;
}
