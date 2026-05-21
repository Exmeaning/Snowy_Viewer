import type { Metadata } from "next";
import StorySpecialListClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Special Stories",
    description: "Browse Project Sekai special stories" + SEO_SUFFIX,
    keywords: getPageKeywords("story_special"),
};

export default function StorySpecialListPage() {
    return <StorySpecialListClient />;
}
