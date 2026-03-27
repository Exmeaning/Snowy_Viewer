import type { Metadata } from "next";
import StoryCardListClient from "./client";

export const metadata: Metadata = { title: "卡牌剧情", description: "浏览 Project Sekai 卡牌剧情" };

export default function StoryCardListPage() {
    return <StoryCardListClient />;
}
