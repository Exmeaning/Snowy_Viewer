import StorySelfListClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_self");

export default function StorySelfListPage() {
    return <StorySelfListClient />;
}
