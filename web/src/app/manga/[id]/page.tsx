import { defineMangaDetailClientPage } from "@/lib/seo-detail-metadata";
import MangaDetailClient from "./client";

const Page = defineMangaDetailClientPage(MangaDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
