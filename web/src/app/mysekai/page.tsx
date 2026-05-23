import MysekaiClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("mysekai", () => <MysekaiClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
