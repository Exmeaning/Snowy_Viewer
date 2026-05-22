import CostumesClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("costumes");

export default function CostumesPage() {
    return <CostumesClient />;
}
