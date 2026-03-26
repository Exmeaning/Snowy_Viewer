import { Metadata } from "next";
import { Suspense } from "react";
import { getMangaMeta } from "@/lib/metadata";
import MangaDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const manga = getMangaMeta(Number(id));

    const title = manga?.title || `第${id}话`;
    const description = `Project Sekai 官方四格漫画 - ${title}`;
    const ogImage = `https://moe.exmeaning.com/mangas/${id}.png`;

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
}

export default function MangaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MangaDetailClient />
        </Suspense>
    );
}
