import type { Metadata } from "next";
import StorySelfListClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Character Introductions",
    description: "Browse Project Sekai character introductions" + SEO_SUFFIX,
    keywords: getPageKeywords("story_self"),
};

export default function StorySelfListPage() {
    return <StorySelfListClient />;
}
