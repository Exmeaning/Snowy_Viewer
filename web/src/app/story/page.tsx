import type { Metadata } from "next";
import StoryIndexClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "剧情",
    description: "浏览 Project Sekai 六类剧情" + SEO_SUFFIX,
    keywords: getPageKeywords("story"),
};

export default function StoryIndexPage() {
    return <StoryIndexClient />;
}
