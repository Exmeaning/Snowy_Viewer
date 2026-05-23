import VirtualLiveContent from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("live", () => <VirtualLiveContent />);

export const generateMetadata = Page.generateMetadata;
export default Page;
