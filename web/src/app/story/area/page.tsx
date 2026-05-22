import StoryAreaListClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_area");

export default function StoryAreaListPage() {
    return <StoryAreaListClient />;
}
