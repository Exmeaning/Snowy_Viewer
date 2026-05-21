import { Metadata } from "next";
import DeckRecommendClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Deck Recommender",
    description: "Project Sekai deck recommender that automatically calculates optimal decks" + SEO_SUFFIX,
    keywords: getPageKeywords("deck_recommend"),
};

import { Suspense } from "react";

export default function DeckRecommendPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <DeckRecommendClient />
        </Suspense>
    );
}
