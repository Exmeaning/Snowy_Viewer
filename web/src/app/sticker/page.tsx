
import { Metadata } from "next";
import StickerContent from "./client";

export const metadata: Metadata = {
    title: "贴纸图鉴",
    description: "浏览 Project Sekai 全部贴纸表情",
};

export default function StickerPage() {
    return <StickerContent />;
}
