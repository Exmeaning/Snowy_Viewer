import type { Metadata } from "next";
import StoryEventListClient from "./client";

export const metadata: Metadata = {
    title: "活动剧情",
    description: "浏览 Project Sekai 活动剧情故事",
};

export default function StoryEventListPage() {
    return <StoryEventListClient />;
}
