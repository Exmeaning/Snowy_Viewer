import StoryUnitReaderClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_unit_reader");

export default function StoryUnitReaderPage() {
    return <StoryUnitReaderClient />;
}
