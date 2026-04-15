
import { Metadata } from "next";
import GuessWhoClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "我是谁",
    description: "Project Sekai 猜角色小游戏" + SEO_SUFFIX,
    keywords: getPageKeywords("guess_who"),
};

export default function GuessWhoPage() {
    return <GuessWhoClient />;
}
