import StoryEventReaderClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_event_reader");

export default function StoryEventReaderPage() {
    return <StoryEventReaderClient />;
}
