import { defineEventDetailClientPage } from "@/lib/seo-detail-metadata";
import EventDetailClient from "./client";

const Page = defineEventDetailClientPage(EventDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
