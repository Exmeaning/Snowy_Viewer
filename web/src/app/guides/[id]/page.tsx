import GuideDetailClient from "./client";
import { guideDetailMetadata } from "@/lib/seo-dynamic-metadata";

export const generateMetadata = guideDetailMetadata;

export default function GuideDetailPage() {
    return <GuideDetailClient />;
}
