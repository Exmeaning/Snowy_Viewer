import { Metadata } from "next";
import MaterialsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "持有物图鉴",
    description: "浏览 Project Sekai 持有物与 MySekai 持有物图鉴" + SEO_SUFFIX,
    keywords: getPageKeywords("materials"),
};

export default function MaterialsPage() {
    return <MaterialsClient />;
}
