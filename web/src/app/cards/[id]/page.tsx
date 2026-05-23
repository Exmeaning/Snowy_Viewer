import { Metadata } from "next";
import { Suspense } from "react";
import { getCardThumbnailUrl } from "@/lib/assets";
import { getCardMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription, getDetailFallbackDescription, getDetailFallbackTitle } from "@/lib/seo-keywords";
import { CHARACTER_NAMES } from "@/types/types";
import CardDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const card = getCardMeta(Number(id));
    if (!card) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("card", locale),
            description: getDetailFallbackDescription("card", locale),
            path: `/cards/${id}`,
        });
    }

    const charName = CHARACTER_NAMES[card.characterId] || "";
    const title = `${charName} - ${card.prefix}`;
    const description = formatDetailSeoDescription("card", { prefix: card.prefix, character: charName }, locale);
    const ogImage = getCardThumbnailUrl(card.characterId, card.asset, false, "main-jp");

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/cards/${id}`,
        images: [ogImage],
    });
}

export default function CardDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CardDetailClient />
        </Suspense>
    );
}
