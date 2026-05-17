import { Metadata } from "next";

import MysekaiPreviewClient from "./client";
import { SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "烤森预览",
    description: "MySekai 烤森 3D 场景布局预览，本地测试 JSON 与 OBJ/纹理资源载入" + SEO_SUFFIX,
    keywords: ["MySekai", "烤森", "场景预览", "3D", "OBJ", "Project Sekai"],
};

export default function MysekaiPreviewPage() {
    return <MysekaiPreviewClient />;
}
