import ExchangesClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("exchanges", () => <ExchangesClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
