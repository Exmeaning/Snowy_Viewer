import { Metadata } from "next";
import HonorsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Honor Achievements",
    description: "Browse Project Sekai honors and achievements" + SEO_SUFFIX,
    keywords: getPageKeywords("honors"),
};

export default function HonorsPage() {
    return <HonorsClient />;
}
