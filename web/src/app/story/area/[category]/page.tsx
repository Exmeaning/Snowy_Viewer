import type { Metadata } from "next";
import StoryAreaDetailClient from "./client";

export const metadata: Metadata = { title: "Area Conversations" };

export default function StoryAreaDetailPage() {
    return <StoryAreaDetailClient />;
}
