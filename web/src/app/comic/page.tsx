
import { Metadata } from "next";
import ComicContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "漫画图鉴",
    description: "浏览 Project Sekai 官方一格漫画" + SEO_SUFFIX,
    keywords: getPageKeywords("comic"),
};

export default function ComicPage() {
    return <ComicContent />;
}
