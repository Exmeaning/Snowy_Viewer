import type { Metadata } from "next";
import StoryEventReaderClient from "./client";

export const metadata: Metadata = { title: "活动剧情阅读" };

export default function StoryEventReaderPage() {
    return <StoryEventReaderClient />;
}
