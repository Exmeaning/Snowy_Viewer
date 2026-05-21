import type { Metadata } from "next";
import StoryAreaTalkClient from "./client";

export const metadata: Metadata = { title: "Area Conversation Reader" };

export default function StoryAreaTalkPage() {
    return <StoryAreaTalkClient />;
}
