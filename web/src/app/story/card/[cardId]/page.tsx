import type { Metadata } from "next";
import StoryCardReaderClient from "./client";

export const metadata: Metadata = { title: "卡牌剧情阅读" };

export default function StoryCardReaderPage() {
    return <StoryCardReaderClient />;
}
