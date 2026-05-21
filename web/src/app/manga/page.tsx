
import { Metadata } from "next";
import MangaClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Official 4-Koma",
    description: "Browse Project Sekai official four-panel comics" + SEO_SUFFIX,
    keywords: getPageKeywords("manga"),
};

export default function MangaPage() {
    return <MangaClient />;
}
