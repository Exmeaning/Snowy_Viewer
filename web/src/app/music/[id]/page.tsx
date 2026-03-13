import { Metadata } from "next";
import { Suspense } from "react";
import { getMusicMeta } from "@/lib/metadata";
import MusicDetailClient from "./client";

const OG_ASSET = "https://snowyassets.exmeaning.com";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const music = getMusicMeta(Number(id));
    if (!music) return { title: "音乐详情" };

    const title = music.title;
    const description = `Project Sekai 歌曲「${music.title}」- 作词: ${music.lyricist} / 作曲: ${music.composer}`;
    const ogImage = `${OG_ASSET}/startapp/music/jacket/${music.asset}/${music.asset}.png`;

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
