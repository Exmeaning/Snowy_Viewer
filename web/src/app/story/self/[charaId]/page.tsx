import StorySelfReaderClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("story_self_reader");

export default function StorySelfReaderPage() {
    return <StorySelfReaderClient />;
}
