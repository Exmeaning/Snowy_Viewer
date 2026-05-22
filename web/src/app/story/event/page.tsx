import StoryEventListClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_event");

export default function StoryEventListPage() {
    return <StoryEventListClient />;
}
