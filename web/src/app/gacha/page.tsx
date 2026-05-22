import GachaContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("gacha");

export default function GachaPage() {
    return <GachaContent />;
}
