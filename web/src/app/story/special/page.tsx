import StorySpecialListClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_special");

export default function StorySpecialListPage() {
    return <StorySpecialListClient />;
}
