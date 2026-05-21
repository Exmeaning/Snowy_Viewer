import type { Metadata } from "next";
import StoryCardReaderClient from "./client";

export const metadata: Metadata = { title: "Card Story Reader" };

export default function StoryCardReaderPage() {
    return <StoryCardReaderClient />;
}
