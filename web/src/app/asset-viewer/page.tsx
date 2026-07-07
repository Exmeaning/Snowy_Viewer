import AssetViewerClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("asset_viewer");

export default function AssetViewerPage() {
    return <AssetViewerClient />;
}
