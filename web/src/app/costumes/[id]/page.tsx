import { Metadata } from "next";
import { Suspense } from "react";
import { getCostumeMeta } from "@/lib/metadata";
import CostumeDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const costume = getCostumeMeta(Number(id));
    if (!costume) return { title: "服装详情" };

    const title = costume.name;
    const description = `Project Sekai 服装「${costume.name}」`;

    return {
        title,
        description,
        openGraph: { title, description },
        twitter: { card: "summary", title, description },
    };
}

export default function CostumeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CostumeDetailClient />
        </Suspense>
    );
}
