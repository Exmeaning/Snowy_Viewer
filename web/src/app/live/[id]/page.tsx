import { Suspense } from "react";
import { IVirtualLiveInfo } from "@/types/virtualLive";
import VirtualLiveDetailClient from "./client";

const VIRTUAL_LIVES_DATA_URL = "https://sekaimaster.exmeaning.com/master/virtualLives.json";

export async function generateStaticParams() {
    try {
        const virtualLives: IVirtualLiveInfo[] = await fetch(VIRTUAL_LIVES_DATA_URL).then((res) => res.json());
        return virtualLives.map((vl) => ({
            id: vl.id.toString(),
        }));
    } catch (e) {
        console.error("Error generating static params for virtual lives:", e);
        return [];
    }
}

export default function VirtualLiveDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <VirtualLiveDetailClient />
        </Suspense>
    );
}
