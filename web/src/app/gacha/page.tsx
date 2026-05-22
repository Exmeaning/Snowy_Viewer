
import { Metadata } from "next";
import GachaContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Gacha Database",
    description: "Browse all Project Sekai gacha banners and view pickup cards and rates" + SEO_SUFFIX,
    keywords: getPageKeywords("gacha"),
};

export default function GachaPage() {
    return <GachaContent />;
}
