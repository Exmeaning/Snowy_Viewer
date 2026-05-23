import { defineCostumeDetailClientPage } from "@/lib/seo-detail-metadata";
import CostumeDetailClient from "./client";

const Page = defineCostumeDetailClientPage(CostumeDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
