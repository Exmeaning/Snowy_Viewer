import type { Metadata } from "next";
import StoryEventDetailClient from "./client";

export const metadata: Metadata = { title: "活动剧情" };

export default function StoryEventDetailPage() {
    return <StoryEventDetailClient />;
}
