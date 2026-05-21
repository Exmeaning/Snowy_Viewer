import type { Metadata } from "next";
import StoryEventReaderClient from "./client";

export const metadata: Metadata = { title: "Event Story Reader" };

export default function StoryEventReaderPage() {
    return <StoryEventReaderClient />;
}
