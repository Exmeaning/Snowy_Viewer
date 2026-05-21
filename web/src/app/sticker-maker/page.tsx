
import { Metadata } from "next";
import StickerMakerContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Sticker Maker",
    description: "Project Sekai sticker maker for creating custom sticker images" + SEO_SUFFIX,
    keywords: getPageKeywords("sticker_maker"),
};

export default function StickerMakerPage() {
    return <StickerMakerContent />;
}
