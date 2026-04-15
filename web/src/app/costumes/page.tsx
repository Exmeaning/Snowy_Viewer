
import { Metadata } from "next";
import CostumesClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "服装图鉴",
    description: "浏览 Project Sekai 全部服装图鉴" + SEO_SUFFIX,
    keywords: getPageKeywords("costumes"),
};

export default function CostumesPage() {
    return <CostumesClient />;
}
