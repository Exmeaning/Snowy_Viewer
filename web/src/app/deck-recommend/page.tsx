import DeckRecommendClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("deck_recommend");

export default function DeckRecommendPage() {
    return <DeckRecommendClient />;
}
