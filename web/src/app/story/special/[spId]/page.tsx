import type { Metadata } from "next";
import StorySpecialReaderClient from "./client";

export const metadata: Metadata = { title: "Special Story Reader" };

export default function StorySpecialReaderPage() {
    return <StorySpecialReaderClient />;
}
