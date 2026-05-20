import { Metadata } from "next";
import MaterialsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Materials Database",
    description: "Browse Project Sekai materials and MySekai materials" + SEO_SUFFIX,
    keywords: getPageKeywords("materials"),
};

export default function MaterialsPage() {
    return <MaterialsClient />;
}
