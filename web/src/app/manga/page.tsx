import MangaClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("manga");

export default function MangaPage() {
    return <MangaClient />;
}
