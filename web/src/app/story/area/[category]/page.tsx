import StoryAreaDetailClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_area_category");

export default function StoryAreaDetailPage() {
    return <StoryAreaDetailClient />;
}
