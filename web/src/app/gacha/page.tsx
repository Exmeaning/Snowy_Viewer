
import { Metadata } from "next";
import GachaContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "扭蛋图鉴",
    description: "浏览 Project Sekai 全部卡池，查看 pickup 卡牌与概率" + SEO_SUFFIX,
    keywords: getPageKeywords("gacha"),
};

export default function GachaPage() {
    return <GachaContent />;
}
