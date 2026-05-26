import InformationClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("information", () => <InformationClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
