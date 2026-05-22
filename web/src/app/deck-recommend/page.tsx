import DeckRecommendClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("deck_recommend");

import { Suspense } from "react";

export default function DeckRecommendPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <DeckRecommendClient />
        </Suspense>
    );
}
