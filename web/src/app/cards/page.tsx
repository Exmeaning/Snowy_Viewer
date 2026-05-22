
import { Metadata } from "next";
import CardsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Card Encyclopedia",
    description: "Browse all Project Sekai cards with character, rarity, and attribute filters" + SEO_SUFFIX,
    keywords: getPageKeywords("cards"),
};

export default function CardsPage() {
    return <CardsClient />;
}
