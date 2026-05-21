import type { Metadata } from "next";
import StoryUnitDetailClient from "./client";

export const metadata: Metadata = { title: "Main Story" };

export default function StoryUnitDetailPage() {
    return <StoryUnitDetailClient />;
}
