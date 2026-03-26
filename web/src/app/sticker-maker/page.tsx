
import { Metadata } from "next";
import StickerMakerContent from "./client";

export const metadata: Metadata = {
    title: "表情包制作",
    description: "Project Sekai 表情包制作工具",
};

export default function StickerMakerPage() {
    return <StickerMakerContent />;
}
