import type { Metadata } from "next";
import StoryUnitDetailClient from "./client";

export const metadata: Metadata = { title: "主线剧情" };

export default function StoryUnitDetailPage() {
    return <StoryUnitDetailClient />;
}
