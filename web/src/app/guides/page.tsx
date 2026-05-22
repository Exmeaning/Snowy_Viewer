import { Metadata } from "next";
import GuidesClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Guides",
    description: "PROJECT SEKAI community guide collection" + SEO_SUFFIX,
    keywords: getPageKeywords("guides"),
};

export default function GuidesPage() {
    return <GuidesClient />;
}
