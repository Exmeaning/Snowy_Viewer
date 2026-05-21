import { Metadata } from "next";
import ScoreControlClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Score Control Calculator",
    description: "Project Sekai score control calculator for planning AFK and score routes" + SEO_SUFFIX,
    keywords: getPageKeywords("score_control"),
};

export default function ScoreControlPage() {
    return <ScoreControlClient />;
}
