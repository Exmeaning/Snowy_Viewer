import { Metadata } from "next";

import MysekaiPreviewSceneClient from "./client";
import { SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "烤森 3D 预览器",
    description: "通过 JP / CN UID 查询 MySekai 烤森房间布局，或在浏览器端读取布局 JSON 文件 / URL 后进入 3D 场景预览" + SEO_SUFFIX,
    keywords: ["MySekai", "烤森", "UID", "布局JSON", "场景预览", "3D", "OBJ", "Project Sekai"],
};

export default function MysekaiPreviewScenePage() {
    return <MysekaiPreviewSceneClient />;
}
