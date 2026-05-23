import GuidesClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("guides", () => <GuidesClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
