import LyricsClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("lyrics", () => <LyricsClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
