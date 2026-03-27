import type { Metadata } from "next";
import StoryAreaDetailClient from "./client";

export const metadata: Metadata = { title: "区域对话" };

export default function StoryAreaDetailPage() {
    return <StoryAreaDetailClient />;
}
