import type { Metadata } from "next";
import StoryIndexClient from "./client";

export const metadata: Metadata = {
    title: "剧情",
    description: "浏览 Project Sekai 六类剧情",
};

export default function StoryIndexPage() {
    return <StoryIndexClient />;
}
