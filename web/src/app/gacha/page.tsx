import GachaContent from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("gacha", () => <GachaContent />);

export const generateMetadata = Page.generateMetadata;
export default Page;
