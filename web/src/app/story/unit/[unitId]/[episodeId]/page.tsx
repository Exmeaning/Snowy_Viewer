import type { Metadata } from "next";
import StoryUnitReaderClient from "./client";

export const metadata: Metadata = { title: "主线剧情阅读" };

export default function StoryUnitReaderPage() {
    return <StoryUnitReaderClient />;
}
