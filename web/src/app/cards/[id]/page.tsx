import { defineCardDetailClientPage } from "@/lib/seo-detail-metadata";
import CardDetailClient from "./client";

const Page = defineCardDetailClientPage(CardDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
