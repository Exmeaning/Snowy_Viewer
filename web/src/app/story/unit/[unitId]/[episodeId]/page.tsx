import type { Metadata } from "next";
import StoryUnitReaderClient from "./client";

export const metadata: Metadata = { title: "Main Story Reader" };

export default function StoryUnitReaderPage() {
    return <StoryUnitReaderClient />;
}
