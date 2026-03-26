import type { Metadata } from "next";
import StorySpecialListClient from "./client";

export const metadata: Metadata = { title: "特殊剧情", description: "浏览 Project Sekai 特殊剧情" };

export default function StorySpecialListPage() {
    return <StorySpecialListClient />;
}
