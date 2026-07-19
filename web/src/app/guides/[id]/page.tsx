import GuideDetailClient from "./client";
import { defineGuideDetailPage } from "@/lib/seo-dynamic-metadata";

const GuideDetailPage = defineGuideDetailPage(() => <GuideDetailClient />);

export const generateMetadata = GuideDetailPage.generateMetadata;
export default GuideDetailPage;
