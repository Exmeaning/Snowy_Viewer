import { Metadata } from "next";
import ChartPreviewContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "谱面预览器",
    description: "MikuMikuWorld 风格 3D 谱面预览，支持选择歌曲或直接输入 SUS/BGM URL" + SEO_SUFFIX,
    keywords: getPageKeywords("chart_preview"),
};

export default function ChartPreviewPage() {
    return <ChartPreviewContent />;
}
