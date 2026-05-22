import GuidesClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("guides");

export default function GuidesPage() {
    return <GuidesClient />;
}
