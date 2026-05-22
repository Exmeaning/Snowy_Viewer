import MusicContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("music");

export default function MusicPage() {
    return <MusicContent />;
}
