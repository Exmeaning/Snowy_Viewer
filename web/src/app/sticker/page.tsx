
import { Metadata } from "next";
import StickerContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Sticker Database",
    description: "Browse all sticker emotes from Project Sekai" + SEO_SUFFIX,
    keywords: getPageKeywords("sticker"),
};

export default function StickerPage() {
    return <StickerContent />;
}
