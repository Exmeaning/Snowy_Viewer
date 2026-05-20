import { Metadata } from "next";
import ExchangesClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Exchange Shop",
    description: "Browse Project Sekai exchange shops and entries" + SEO_SUFFIX,
    keywords: getPageKeywords("exchanges"),
};

export default function ExchangesPage() {
    return <ExchangesClient />;
}
