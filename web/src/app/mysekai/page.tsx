
import { Metadata } from "next";
import MysekaiClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Furniture Database",
    description: "Browse the Project SEKAI MySEKAI furniture database" + SEO_SUFFIX,
    keywords: getPageKeywords("mysekai"),
};

export default function MysekaiPage() {
    return <MysekaiClient />;
}
