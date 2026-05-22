import MusicMetaClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("music_meta");

export default function MusicMetaPage() {
    return <MusicMetaClient />;
}
