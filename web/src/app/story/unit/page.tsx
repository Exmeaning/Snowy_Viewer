import type { Metadata } from "next";
import StoryUnitListClient from "./client";

export const metadata: Metadata = { title: "主线剧情", description: "浏览 Project Sekai 主线剧情" };

export default function StoryUnitListPage() {
    return <StoryUnitListClient />;
}
