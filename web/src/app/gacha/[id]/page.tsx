import { defineGachaDetailClientPage } from "@/lib/seo-detail-metadata";
import GachaDetailClient from "./client";

const Page = defineGachaDetailClientPage(GachaDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
