import { Suspense } from "react";
import { ISnowyCostumesData } from "@/types/costume";
import CostumeDetailClient from "./client";
import { fetchMasterData } from "@/lib/fetch";

export async function generateStaticParams() {
    try {
        const data = await fetchMasterData<ISnowyCostumesData>("snowy_costumes.json");
        const costumes = data.costumes || [];
        // Extract unique costume3dGroupIds
        const groupIds = [...new Set(costumes.map(c => c.costume3dGroupId))];
        return groupIds.map((id) => ({
            id: id.toString(),
        }));
    } catch (e) {
        console.error("Error generating static params for costumes:", e);
        return [];
    }
}

export default function CostumeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CostumeDetailClient />
        </Suspense>
    );
}
