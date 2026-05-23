import StorySpecialReaderClient from "./client";
import { defineStorySpecialReaderPage } from "@/lib/seo-story-metadata";

const Page = defineStorySpecialReaderPage(() => <StorySpecialReaderClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
