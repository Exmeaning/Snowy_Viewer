import { Metadata } from "next";
import HonorsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "称号成就",
    description: "浏览 Project Sekai 称号成就图鉴" + SEO_SUFFIX,
    keywords: getPageKeywords("honors"),
};

export default function HonorsPage() {
    return <HonorsClient />;
}
