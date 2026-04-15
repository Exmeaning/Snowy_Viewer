
import { Metadata } from "next";
import CardsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "卡牌图鉴",
    description: "浏览 Project Sekai 全部卡牌，支持按角色、稀有度、属性筛选" + SEO_SUFFIX,
    keywords: getPageKeywords("cards"),
};

export default function CardsPage() {
    return <CardsClient />;
}
