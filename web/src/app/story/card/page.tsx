import type { Metadata } from "next";
import StoryCardListClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Card Stories",
    description: "Browse Project Sekai card stories" + SEO_SUFFIX,
    keywords: getPageKeywords("story_card"),
};

export default function StoryCardListPage() {
    return <StoryCardListClient />;
}
