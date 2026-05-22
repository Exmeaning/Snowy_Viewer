import StickerContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("sticker");

export default function StickerPage() {
    return <StickerContent />;
}
