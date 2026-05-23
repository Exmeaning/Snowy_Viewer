import StoryIndexClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("story", () => <StoryIndexClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
