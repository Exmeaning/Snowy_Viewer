import { Metadata } from "next";
import RealtimeRankingClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "实时排行榜",
    description: "查看 Project SEKAI 实时排行榜，支持 CN / JP / TW / KR / EN 切换与分数变化提示。" + SEO_SUFFIX,
    keywords: getPageKeywords("realtime_ranking"),
};

export default function RealtimeRankingPage() {
    return <RealtimeRankingClient />;
}
