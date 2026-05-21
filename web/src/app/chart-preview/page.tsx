import { Metadata } from "next";
import ChartPreviewContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Chart Previewer",
    description: "MikuMikuWorld-style 3D chart previewer with song selection or custom SUS/BGM URLs" + SEO_SUFFIX,
    keywords: getPageKeywords("chart_preview"),
};

export default function ChartPreviewPage() {
    return <ChartPreviewContent />;
}
