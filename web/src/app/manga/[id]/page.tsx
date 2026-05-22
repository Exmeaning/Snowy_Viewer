import { Metadata } from "next";
import { Suspense } from "react";
import { getMangaMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription } from "@/lib/seo-keywords";
import MangaDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const manga = getMangaMeta(Number(id));

    const title = manga?.title || `Episode ${id}`;
    const description = formatDetailSeoDescription("manga", { title }, locale);
    const ogImage = `https://moe.exmeaning.com/mangas/${id}.png`;

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/manga/${id}`,
        images: [ogImage],
    });
}

export default function MangaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MangaDetailClient />
        </Suspense>
    );
}
