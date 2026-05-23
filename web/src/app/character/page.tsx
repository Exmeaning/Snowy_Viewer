import CharacterListContent from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("character", () => <CharacterListContent />);

export const generateMetadata = Page.generateMetadata;
export default Page;
