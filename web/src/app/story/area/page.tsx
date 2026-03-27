import type { Metadata } from "next";
import StoryAreaListClient from "./client";

export const metadata: Metadata = { title: "区域对话", description: "浏览 Project Sekai 区域对话" };

export default function StoryAreaListPage() {
    return <StoryAreaListClient />;
}
