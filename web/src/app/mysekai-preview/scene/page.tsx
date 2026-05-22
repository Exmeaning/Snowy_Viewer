import MysekaiPreviewSceneClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("mysekai_preview_scene");

export default function MysekaiPreviewScenePage() {
    return <MysekaiPreviewSceneClient />;
}
