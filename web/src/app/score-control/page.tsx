import { Metadata } from "next";
import ScoreControlClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "控分计算器",
    description: "Project Sekai 控分计算器" + SEO_SUFFIX,
    keywords: getPageKeywords("score_control"),
};

export default function ScoreControlPage() {
    return <ScoreControlClient />;
}
