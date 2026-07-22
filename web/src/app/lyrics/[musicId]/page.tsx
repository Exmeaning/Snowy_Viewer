import { notFound } from "next/navigation";

import { getMusicJacketUrl } from "@/lib/assets";
import { getPublishedLyricsIndexEntry } from "@/lib/lyrics";
import { getMusicMeta } from "@/lib/metadata";
import { createDetailFallbackMetadata, createDynamicDetailMetadata, getSeoAssetSource } from "@/lib/seo-metadata";
import LyricsDetailClient from "./client";

interface LyricsDetailPageProps {
    params: Promise<{ musicId: string }>;
}

export async function generateMetadata({ params }: LyricsDetailPageProps) {
    const { musicId } = await params;
    const numericId = Number(musicId);
    const publication = await getPublishedLyricsIndexEntry(numericId);
    if (!publication) {
        return createDetailFallbackMetadata("lyrics", `/lyrics/${musicId}`, "summary");
    }

    return createDynamicDetailMetadata({
        params: Promise.resolve({ id: musicId }),
        kind: "lyrics",
        routePrefix: "lyrics",
        getData: getMusicMeta,
        build: (music, { locale }) => ({
            title: music.title,
            descriptionKind: "lyrics",
            descriptionValues: { title: music.title },
            images: [getMusicJacketUrl(music.asset, getSeoAssetSource(locale))],
            twitterCard: "summary",
        }),
    });
}

export default async function LyricsDetailPage({ params }: LyricsDetailPageProps) {
    const { musicId } = await params;
    const publication = await getPublishedLyricsIndexEntry(Number(musicId));
    if (!publication) notFound();
    return <LyricsDetailClient />;
}
