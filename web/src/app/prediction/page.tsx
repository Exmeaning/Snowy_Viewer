
import { Metadata } from "next";
import PredictionClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "活动预测",
    description: "Project Sekai 活动排名预测工具" + SEO_SUFFIX,
    keywords: getPageKeywords("prediction"),
};

export default function PredictionPage() {
    return <PredictionClient />;
}
