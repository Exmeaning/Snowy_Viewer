import { Suspense } from "react";
import GachaDetailClient from "./client";

// Static params for SSG
export async function generateStaticParams() {
    try {
        const response = await fetch("https://sekaimaster.exmeaning.com/master/gachas.json");
        if (!response.ok) return [];
        const gachas = await response.json();
        return gachas.map((gacha: { id: number }) => ({
            id: gacha.id.toString(),
        }));
    } catch {
        return [];
    }
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function GachaDetailPage({ params }: PageProps) {
    const { id } = await params;
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <GachaDetailClient gachaId={id} />
        </Suspense>
    );
}
