import { defineExchangeDetailClientPage } from "@/lib/seo-detail-metadata";
import ExchangeDetailClient from "./client";

const Page = defineExchangeDetailClientPage(ExchangeDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
