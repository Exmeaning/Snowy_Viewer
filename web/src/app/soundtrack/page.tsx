import SoundtrackContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("soundtrack");

export default function SoundtrackPage() {
    return <SoundtrackContent />;
}
