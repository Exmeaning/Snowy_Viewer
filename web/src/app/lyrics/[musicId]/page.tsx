import { getMusicJacketUrl } from "@/lib/assets";
import { getMusicMeta } from "@/lib/metadata";
import { createDynamicDetailMetadata, getSeoAssetSource } from "@/lib/seo-metadata";
import LyricsDetailClient from "./client";

interface LyricsDetailPageProps {
    params: Promise<{ musicId: string }>;
}

export function generateMetadata({ params }: LyricsDetailPageProps) {
    return createDynamicDetailMetadata({
        params: params.then(({ musicId }) => ({ id: musicId })),
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

export default function LyricsDetailPage() {
    return <LyricsDetailClient />;
}
