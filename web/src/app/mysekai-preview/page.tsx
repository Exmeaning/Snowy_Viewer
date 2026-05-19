import { Metadata } from "next";

import MysekaiPreviewClient from "./client";
import { SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "烤森百景",
    description: "浏览 Project Sekai MySekai 烤森百景活动 TOP 投稿排行与缩略图" + SEO_SUFFIX,
    keywords: ["MySekai", "烤森百景", "百景", "TOP排行", "活动排行", "Project Sekai"],
};

export default function MysekaiPreviewPage() {
    return <MysekaiPreviewClient />;
}
