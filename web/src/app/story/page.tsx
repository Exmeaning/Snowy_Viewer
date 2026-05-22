import StoryIndexClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story");

export default function StoryIndexPage() {
    return <StoryIndexClient />;
}
