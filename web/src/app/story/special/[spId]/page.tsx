import StorySpecialReaderClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_special_reader");

export default function StorySpecialReaderPage() {
    return <StorySpecialReaderClient />;
}
