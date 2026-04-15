import { Metadata } from "next";
import GuessJacketClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "猜曲绘",
    description: "Project Sekai 猜曲绘小游戏" + SEO_SUFFIX,
    keywords: getPageKeywords("guess_jacket"),
};

export default function GuessJacketPage() {
    return <GuessJacketClient />;
}
