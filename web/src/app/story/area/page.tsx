import type { Metadata } from "next";
import StoryAreaListClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Area Conversations",
    description: "Browse Project Sekai area conversations" + SEO_SUFFIX,
    keywords: getPageKeywords("story_area"),
};

export default function StoryAreaListPage() {
    return <StoryAreaListClient />;
}
