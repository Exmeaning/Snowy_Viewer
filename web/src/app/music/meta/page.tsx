
import { Metadata } from "next";
import MusicMetaClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "歌曲Meta",
    description: "Project Sekai 歌曲效率数据与排行" + SEO_SUFFIX,
    keywords: getPageKeywords("music_meta"),
};

export default function MusicMetaPage() {
    return <MusicMetaClient />;
}
