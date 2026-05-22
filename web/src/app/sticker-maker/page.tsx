import StickerMakerContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("sticker_maker");

export default function StickerMakerPage() {
    return <StickerMakerContent />;
}
