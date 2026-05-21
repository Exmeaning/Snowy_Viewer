import { Metadata } from "next";

import MysekaiRankingPreviewClient from "./client";
import { SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "MySekai Housing Entry Preview",
    description: "View a 3D layout preview for a ranked Project Sekai MySekai housing competition entry" + SEO_SUFFIX,
    keywords: ["MySekai", "housing competition", "ranked entry", "3D preview", "Project Sekai"],
};

export default function MysekaiRankingPreviewPage() {
    return <MysekaiRankingPreviewClient />;
}
