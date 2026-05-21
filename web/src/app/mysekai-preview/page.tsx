import { Metadata } from "next";

import MysekaiPreviewClient from "./client";
import { SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "MySekai Housing Competition",
    description: "Browse top Project Sekai MySekai housing competition entries and thumbnails" + SEO_SUFFIX,
    keywords: ["MySekai", "housing competition", "top entries", "ranking", "3D preview", "Project Sekai"],
};

export default function MysekaiPreviewPage() {
    return <MysekaiPreviewClient />;
}
