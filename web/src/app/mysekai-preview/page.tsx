import MysekaiPreviewClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("mysekai_preview");

export default function MysekaiPreviewPage() {
    return <MysekaiPreviewClient />;
}
