import { Metadata } from "next";
import ExchangesClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "兑换所",
    description: "浏览 Project Sekai 数据库中的兑换所与兑换项信息" + SEO_SUFFIX,
    keywords: getPageKeywords("exchanges"),
};

export default function ExchangesPage() {
    return <ExchangesClient />;
}
