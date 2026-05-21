import { Metadata } from "next";
import MyMaterialsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Resource Inventory",
    description: "Check your Project Sekai resources and materials" + SEO_SUFFIX,
    keywords: getPageKeywords("my_materials"),
};

export default function MyMaterialsPage() {
    return <MyMaterialsClient />;
}
