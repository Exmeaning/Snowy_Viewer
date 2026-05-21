import { Metadata } from "next";
import DeckComparatorClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Deck Comparator",
    description: "Project Sekai deck comparator for comparing multi-live PT and score outcomes" + SEO_SUFFIX,
    keywords: getPageKeywords("deck_comparator"),
};

export default function DeckComparatorPage() {
    return <DeckComparatorClient />;
}
