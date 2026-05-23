import StoryCardReaderClient from "./client";
import { defineStoryCardReaderPage } from "@/lib/seo-story-metadata";

const Page = defineStoryCardReaderPage(() => <StoryCardReaderClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
