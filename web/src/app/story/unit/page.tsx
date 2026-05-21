import type { Metadata } from "next";
import StoryUnitListClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Main Stories",
    description: "Browse Project Sekai main stories" + SEO_SUFFIX,
    keywords: getPageKeywords("story_unit"),
};

export default function StoryUnitListPage() {
    return <StoryUnitListClient />;
}
