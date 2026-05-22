import StoryCardReaderClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_card_reader");

export default function StoryCardReaderPage() {
    return <StoryCardReaderClient />;
}
