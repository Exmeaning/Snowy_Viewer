import type { Metadata } from "next";
import StoryEventDetailClient from "./client";

export const metadata: Metadata = { title: "Event Story" };

export default function StoryEventDetailPage() {
    return <StoryEventDetailClient />;
}
