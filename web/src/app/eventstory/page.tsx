
import { Metadata } from "next";
import StoryListClient from "./client";

export const metadata: Metadata = {
    title: "活动剧情",
    description: "浏览 Project Sekai 活动剧情故事",
};

export default function StoryListPage() {
    return <StoryListClient />;
}
