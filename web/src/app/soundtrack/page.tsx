import { Metadata } from "next";
import SoundtrackContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "游戏原声带",
    description: "精致的 Project Sekai 背景音乐原声带播放器" + SEO_SUFFIX,
    keywords: getPageKeywords("soundtrack"),
};

export default function SoundtrackPage() {
    return <SoundtrackContent />;
}
