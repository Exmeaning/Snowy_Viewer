import { Metadata } from "next";
import DeckComparatorClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "组卡比较器",
    description: "Project Sekai 组卡比较器" + SEO_SUFFIX,
    keywords: getPageKeywords("deck_comparator"),
};

export default function DeckComparatorPage() {
    return <DeckComparatorClient />;
}
