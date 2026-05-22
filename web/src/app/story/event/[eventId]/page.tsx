import StoryEventDetailClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_event_group");

export default function StoryEventDetailPage() {
    return <StoryEventDetailClient />;
}
