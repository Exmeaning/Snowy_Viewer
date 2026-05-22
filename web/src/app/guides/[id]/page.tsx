import GuideDetailClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("guides_detail");

export default function GuideDetailPage() {
    return <GuideDetailClient />;
}
