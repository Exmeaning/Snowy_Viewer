import StoryCardListClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_card");

export default function StoryCardListPage() {
    return <StoryCardListClient />;
}
