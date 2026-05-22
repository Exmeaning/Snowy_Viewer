import ChartPreviewContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("chart_preview");

export default function ChartPreviewPage() {
    return <ChartPreviewContent />;
}
