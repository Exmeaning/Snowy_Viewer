import { Metadata } from "next";
import { Suspense } from "react";
import { getMusicJacketUrl } from "@/lib/assets";
import { getMusicMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription, getDetailFallbackTitle } from "@/lib/seo-keywords";
import MusicDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const music = getMusicMeta(Number(id));
    if (!music) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("music", locale),
            description: getDetailFallbackTitle("music", locale),
            path: `/music/${id}`,
        });
    }

    const title = music.title;
    const description = formatDetailSeoDescription(
        "music",
        { title: music.title, lyricist: music.lyricist, composer: music.composer },
        locale,
    );
    const ogImage = getMusicJacketUrl(music.asset, "main-jp");

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/music/${id}`,
        images: [ogImage],
        twitterCard: "summary",
    });
}

export default function MusicDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MusicDetailClient />
        </Suspense>
    );
}
