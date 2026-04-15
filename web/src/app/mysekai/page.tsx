
import { Metadata } from "next";
import MysekaiClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "家具图鉴",
    description: "浏览 Project Sekai MySEKAI 家具图鉴" + SEO_SUFFIX,
    keywords: getPageKeywords("mysekai"),
};

export default function MysekaiPage() {
    return <MysekaiClient />;
}
