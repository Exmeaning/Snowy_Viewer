import CardsClient from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("cards", () => <CardsClient />);

export const generateMetadata = Page.generateMetadata;
export default Page;
