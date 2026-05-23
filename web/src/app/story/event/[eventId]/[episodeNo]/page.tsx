import StoryEventReaderClient from "./client";
import { defineStoryEventReaderPage } from "@/lib/seo-story-metadata";

const Page = defineStoryEventReaderPage(() => <StoryEventReaderClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
