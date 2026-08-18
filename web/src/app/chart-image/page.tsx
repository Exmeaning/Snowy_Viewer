import ChartImageContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("chart_image");

export default function ChartImagePage() {
    return <ChartImageContent />;
}
