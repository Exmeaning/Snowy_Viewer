import { Metadata } from "next";
import DeckRecommendClient from "./client";

export const metadata: Metadata = {
    title: "组卡推荐器",
    description: "Project Sekai 组卡推荐器，自动计算最优卡组",
};

import { Suspense } from "react";

export default function DeckRecommendPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <DeckRecommendClient />
        </Suspense>
    );
}
