
import { Metadata } from "next";
import StickerContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "贴纸图鉴",
    description: "浏览 Project Sekai 全部贴纸表情" + SEO_SUFFIX,
    keywords: getPageKeywords("sticker"),
};

export default function StickerPage() {
    return <StickerContent />;
}
