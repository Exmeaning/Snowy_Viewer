import StoryAreaDetailClient from "./client";
import { defineStoryAreaCategoryPage } from "@/lib/seo-story-metadata";

const Page = defineStoryAreaCategoryPage(() => <StoryAreaDetailClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
