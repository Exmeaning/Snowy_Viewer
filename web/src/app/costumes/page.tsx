
import { Metadata } from "next";
import CostumesClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Costumes",
    description: "Browse all costumes in Project SEKAI" + SEO_SUFFIX,
    keywords: getPageKeywords("costumes"),
};

export default function CostumesPage() {
    return <CostumesClient />;
}
