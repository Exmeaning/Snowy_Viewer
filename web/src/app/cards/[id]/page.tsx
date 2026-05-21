import { Metadata } from "next";
import { Suspense } from "react";
import { getCardThumbnailUrl } from "@/lib/assets";
import { getCardMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import { CHARACTER_NAMES } from "@/types/types";
import CardDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const card = getCardMeta(Number(id));
    if (!card) return { title: "Card Detail" };

    const charName = CHARACTER_NAMES[card.characterId] || "";
    const title = `${charName} - ${card.prefix}`;
    const description = `Project Sekai Card "${card.prefix}" - ${charName}` + DETAIL_SEO_SUFFIX;
    const ogImage = getCardThumbnailUrl(card.characterId, card.asset, false, "main-jp");

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    };
}

export default function CardDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CardDetailClient />
        </Suspense>
    );
}
