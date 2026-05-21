import { Metadata } from "next";

import MysekaiPreviewSceneClient from "./client";
import { SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "MySekai 3D Previewer",
    description: "Preview MySekai room layouts by JP / CN UID, local JSON files, or public JSON URLs" + SEO_SUFFIX,
    keywords: ["MySekai", "UID", "layout JSON", "scene preview", "3D", "OBJ", "Project Sekai"],
};

export default function MysekaiPreviewScenePage() {
    return <MysekaiPreviewSceneClient />;
}
