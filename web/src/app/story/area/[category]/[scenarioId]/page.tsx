import type { Metadata } from "next";
import StoryAreaTalkClient from "./client";

export const metadata: Metadata = { title: "区域对话阅读" };

export default function StoryAreaTalkPage() {
    return <StoryAreaTalkClient />;
}
