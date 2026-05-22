import EventsContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("events");

export default function EventsPage() {
    return <EventsContent />;
}
