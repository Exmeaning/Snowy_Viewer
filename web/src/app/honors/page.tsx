import HonorsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("honors");

export default function HonorsPage() {
    return <HonorsClient />;
}
