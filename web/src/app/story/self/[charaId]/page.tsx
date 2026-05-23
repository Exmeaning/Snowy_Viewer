import StorySelfReaderClient from "./client";
import { defineStorySelfReaderPage } from "@/lib/seo-story-metadata";

const Page = defineStorySelfReaderPage(() => <StorySelfReaderClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
