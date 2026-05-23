import CostumesClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("costumes", () => <CostumesClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
