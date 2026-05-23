import StoryAreaTalkClient from "./client";
import { defineStoryAreaReaderPage } from "@/lib/seo-story-metadata";

const Page = defineStoryAreaReaderPage(() => <StoryAreaTalkClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
