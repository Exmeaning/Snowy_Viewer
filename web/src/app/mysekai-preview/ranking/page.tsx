import { Metadata } from "next";

import MysekaiRankingPreviewClient from "./client";
import { SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "烤森百景预览",
    description: "查看 Project Sekai MySekai 烤森百景排行投稿的 3D 布局预览" + SEO_SUFFIX,
    keywords: ["MySekai", "烤森百景", "百景", "3D预览", "Project Sekai"],
};

export default function MysekaiRankingPreviewPage() {
    return <MysekaiRankingPreviewClient />;
}
