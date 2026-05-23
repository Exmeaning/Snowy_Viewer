import { Suspense } from "react";
import { getCardThumbnailUrl } from "@/lib/assets";
import { getCardMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import { CHARACTER_NAMES } from "@/types/types";
import CardDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "card",
    routePrefix: "cards",
    getData: getCardMeta,
    build: (card) => {
        const charName = CHARACTER_NAMES[card.characterId] || "";

        return {
            title: `${charName} - ${card.prefix}`,
            descriptionKind: "card",
            descriptionValues: { prefix: card.prefix, character: charName },
            images: [getCardThumbnailUrl(card.characterId, card.asset, false, "main-jp")],
        };
    },
});

export default function CardDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CardDetailClient />
        </Suspense>
    );
}
