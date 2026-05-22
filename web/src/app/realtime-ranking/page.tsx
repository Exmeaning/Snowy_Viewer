import RealtimeRankingClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("realtime_ranking");

export default function RealtimeRankingPage() {
    return <RealtimeRankingClient />;
}
