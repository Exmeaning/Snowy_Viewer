import { Metadata } from "next";
import RealtimeRankingClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Live Ranking",
    description: "View Project SEKAI live ranking with CN / JP / TW / KR / EN region switching and score change hints." + SEO_SUFFIX,
    keywords: getPageKeywords("realtime_ranking"),
};

export default function RealtimeRankingPage() {
    return <RealtimeRankingClient />;
}
