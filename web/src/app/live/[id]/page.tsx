import { defineLiveDetailClientPage } from "@/lib/seo-detail-metadata";
import VirtualLiveDetailClient from "./client";

const Page = defineLiveDetailClientPage(VirtualLiveDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
