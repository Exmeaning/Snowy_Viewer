import type { Metadata } from "next";
import StorySelfReaderClient from "./client";

export const metadata: Metadata = { title: "自我介绍阅读" };

export default function StorySelfReaderPage() {
    return <StorySelfReaderClient />;
}
