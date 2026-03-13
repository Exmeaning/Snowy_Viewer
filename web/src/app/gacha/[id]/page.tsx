import { Metadata } from "next";
import { Suspense } from "react";
import { getGachaMeta } from "@/lib/metadata";
import GachaDetailClient from "./client";

const OG_ASSET = "https://snowyassets.exmeaning.com";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const gacha = getGachaMeta(Number(id));
    if (!gacha) return { title: "卡池详情" };

    const title = gacha.name;
    const description = `Project Sekai 卡池「${gacha.name}」`;
    const ogImage = `${OG_ASSET}/ondemand/gacha/${gacha.asset}/logo/logo.png`;

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary", title, description, images: [ogImage] },
    };
}

export default function GachaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <GachaDetailClient />
        </Suspense>
    );
}
