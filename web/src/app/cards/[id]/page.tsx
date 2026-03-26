import { Metadata } from "next";
import { Suspense } from "react";
import { getCardMeta } from "@/lib/metadata";
import { CHARACTER_NAMES } from "@/types/types";
import CardDetailClient from "./client";

const OG_ASSET = "https://snowyassets.exmeaning.com";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const card = getCardMeta(Number(id));
    if (!card) return { title: "卡牌详情" };

    const charName = CHARACTER_NAMES[card.characterId] || "";
    const title = `${charName} - ${card.prefix}`;
    const description = `Project Sekai 卡牌「${card.prefix}」- ${charName}`;
    const ogImage = `${OG_ASSET}/startapp/thumbnail/chara/${card.asset}_normal.png`;

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
