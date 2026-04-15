
import { Metadata } from "next";
import StickerMakerContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "表情包制作",
    description: "Project Sekai 表情包制作工具" + SEO_SUFFIX,
    keywords: getPageKeywords("sticker_maker"),
};

export default function StickerMakerPage() {
    return <StickerMakerContent />;
}
