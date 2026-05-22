import { Metadata } from "next";
import { Suspense } from "react";
import { getMusicJacketUrl } from "@/lib/assets";
import { getMusicMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import MusicDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const music = getMusicMeta(Number(id));
    if (!music) return { title: "Music Details" };

    const title = music.title;
    const description = `Project Sekai song "${music.title}" - Lyricist: ${music.lyricist} / Composer: ${music.composer}` + DETAIL_SEO_SUFFIX;
    const ogImage = getMusicJacketUrl(music.asset, "main-jp");

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary", title, description, images: [ogImage] },
    };
}

export default function MusicDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MusicDetailClient />
        </Suspense>
    );
}
