import { defineMusicDetailClientPage } from "@/lib/seo-detail-metadata";
import MusicDetailClient from "./client";

const Page = defineMusicDetailClientPage(MusicDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
