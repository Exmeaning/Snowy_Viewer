import StoryUnitReaderClient from "./client";
import { defineStoryUnitReaderPage } from "@/lib/seo-story-metadata";

const Page = defineStoryUnitReaderPage(() => <StoryUnitReaderClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
