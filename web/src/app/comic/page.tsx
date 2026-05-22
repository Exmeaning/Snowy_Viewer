import ComicContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("comic");

export default function ComicPage() {
    return <ComicContent />;
}
