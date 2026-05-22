import DeckComparatorClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("deck_comparator");

export default function DeckComparatorPage() {
    return <DeckComparatorClient />;
}
