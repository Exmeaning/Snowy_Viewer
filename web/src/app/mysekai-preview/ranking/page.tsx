import MysekaiRankingPreviewClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("mysekai_preview_ranking");

export default function MysekaiRankingPreviewPage() {
    return <MysekaiRankingPreviewClient />;
}
