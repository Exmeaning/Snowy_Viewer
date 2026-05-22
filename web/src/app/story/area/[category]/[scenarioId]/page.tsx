import StoryAreaTalkClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_area_reader");

export default function StoryAreaTalkPage() {
    return <StoryAreaTalkClient />;
}
