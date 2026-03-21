import { Metadata } from "next";
import RealtimeRankingClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - 实时排行榜",
    description: "查看 Project SEKAI 实时排行榜，支持 CN / JP 切换与分数变化提示。",
};

export default function RealtimeRankingPage() {
    return <RealtimeRankingClient />;
}
