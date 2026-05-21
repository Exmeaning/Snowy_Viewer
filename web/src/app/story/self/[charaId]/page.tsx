import type { Metadata } from "next";
import StorySelfReaderClient from "./client";

export const metadata: Metadata = { title: "Character Introduction Reader" };

export default function StorySelfReaderPage() {
    return <StorySelfReaderClient />;
}
