import type { Metadata } from "next";
import StoryEventListClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Event Stories",
    description: "Browse Project Sekai event stories" + SEO_SUFFIX,
    keywords: getPageKeywords("story_event"),
};

export default function StoryEventListPage() {
    return <StoryEventListClient />;
}
