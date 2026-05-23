import MangaClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("manga", () => <MangaClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
