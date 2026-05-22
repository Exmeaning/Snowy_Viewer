import MaterialsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("materials");

export default function MaterialsPage() {
    return <MaterialsClient />;
}
