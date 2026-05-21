
import { Metadata } from "next";
import ComicContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Comic Database",
    description: "Browse Project Sekai official one-panel comics" + SEO_SUFFIX,
    keywords: getPageKeywords("comic"),
};

export default function ComicPage() {
    return <ComicContent />;
}
