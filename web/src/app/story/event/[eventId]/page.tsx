import StoryEventDetailClient from "./client";
import { defineStoryEventGroupPage } from "@/lib/seo-story-metadata";

const Page = defineStoryEventGroupPage(() => <StoryEventDetailClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
