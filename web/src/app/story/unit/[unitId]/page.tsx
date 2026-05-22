import StoryUnitDetailClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_unit_group");

export default function StoryUnitDetailPage() {
    return <StoryUnitDetailClient />;
}
