import { Suspense } from "react";
import GachaDetailClient from "./client";
import { fetchMasterData } from "@/lib/fetch";
import { IGachaInfo } from "@/types/types";

// Static params for SSG
export const dynamicParams = false;

export async function generateStaticParams() {
    console.log("Generating static params for gacha/[id]...");
    try {
        const gachas = await fetchMasterData<IGachaInfo[]>("gachas.json");
        console.log(`Found ${gachas.length} gachas.`);
        return gachas.map((gacha) => ({
            id: gacha.id.toString(),
        }));
    } catch (e) {
        console.error("Error generating static params for gacha:", e);
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
