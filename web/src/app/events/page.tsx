
import { Metadata } from "next";
import EventsContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Event Encyclopedia",
    description: "Browse all Project Sekai events and view event details and rankings" + SEO_SUFFIX,
    keywords: getPageKeywords("events"),
};

export default function EventsPage() {
    return <EventsContent />;
}
