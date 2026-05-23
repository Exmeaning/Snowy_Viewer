import MusicContent from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("music", () => <MusicContent />);

export const generateMetadata = Page.generateMetadata;
export default Page;
