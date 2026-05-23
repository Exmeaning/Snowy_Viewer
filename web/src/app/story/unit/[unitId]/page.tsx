import StoryUnitDetailClient from "./client";
import { defineStoryUnitGroupPage } from "@/lib/seo-story-metadata";

const Page = defineStoryUnitGroupPage(() => <StoryUnitDetailClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
