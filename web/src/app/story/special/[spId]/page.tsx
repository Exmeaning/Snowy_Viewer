import type { Metadata } from "next";
import StorySpecialReaderClient from "./client";

export const metadata: Metadata = { title: "特殊剧情阅读" };

export default function StorySpecialReaderPage() {
    return <StorySpecialReaderClient />;
}
