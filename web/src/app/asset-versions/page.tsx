import AssetVersionsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("asset_versions");

export default function AssetVersionsPage() {
    return <AssetVersionsClient />;
}
