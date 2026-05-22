
import { Metadata } from "next";
import MusicContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Music Encyclopedia",
    description: "Browse all Project Sekai songs and view chart difficulty and composer information" + SEO_SUFFIX,
    keywords: getPageKeywords("music"),
};

export default function MusicPage() {
    return <MusicContent />;
}
