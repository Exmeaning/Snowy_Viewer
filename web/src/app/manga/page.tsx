
import { Metadata } from "next";
import MangaClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "官方四格",
    description: "浏览 Project Sekai 官方四格漫画" + SEO_SUFFIX,
    keywords: getPageKeywords("manga"),
};

export default function MangaPage() {
    return <MangaClient />;
}
