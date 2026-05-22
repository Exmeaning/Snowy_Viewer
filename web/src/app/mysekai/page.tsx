import MysekaiClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("mysekai");

export default function MysekaiPage() {
    return <MysekaiClient />;
}
