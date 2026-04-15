
import { Metadata } from "next";
import VirtualLiveContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "演唱会",
    description: "浏览 Project Sekai 虚拟 Live 演唱会信息" + SEO_SUFFIX,
    keywords: getPageKeywords("live"),
};

export default function LivePage() {
    return <VirtualLiveContent />;
}
