import StoryUnitListClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_unit");

export default function StoryUnitListPage() {
    return <StoryUnitListClient />;
}
