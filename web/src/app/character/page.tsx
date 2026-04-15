
import { Metadata } from "next";
import CharacterListContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "角色图鉴",
    description: "浏览 Project Sekai 全部角色资料与详细信息" + SEO_SUFFIX,
    keywords: getPageKeywords("character"),
};

export default function CharacterPage() {
    return <CharacterListContent />;
}
