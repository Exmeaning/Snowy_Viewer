import RealtimeRankingNextClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("realtime_ranking_next");

export default function RealtimeRankingNextPage() {
    return <RealtimeRankingNextClient />;
}
