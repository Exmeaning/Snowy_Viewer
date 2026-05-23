import { defineMysekaiFixtureDetailClientPage } from "@/lib/seo-detail-metadata";
import MysekaiFixtureDetailClient from "./client";

const Page = defineMysekaiFixtureDetailClientPage(MysekaiFixtureDetailClient);

export const generateMetadata = Page.generateMetadata;
export default Page;
