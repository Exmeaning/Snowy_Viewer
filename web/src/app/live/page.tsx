
import { Metadata } from "next";
import VirtualLiveContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Virtual Live Database",
    description: "Browse Project Sekai virtual live information" + SEO_SUFFIX,
    keywords: getPageKeywords("live"),
};

export default function LivePage() {
    return <VirtualLiveContent />;
}
