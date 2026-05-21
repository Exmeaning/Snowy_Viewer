import type { Metadata } from "next";
import StoryIndexClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Story Browser",
    description: "Browse six types of Project Sekai stories" + SEO_SUFFIX,
    keywords: getPageKeywords("story"),
};

export default function StoryIndexPage() {
    return <StoryIndexClient />;
}
