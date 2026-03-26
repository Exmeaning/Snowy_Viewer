
import { Metadata } from "next";
import GachaContent from "./client";

export const metadata: Metadata = {
    title: "扭蛋图鉴",
    description: "浏览 Project Sekai 全部卡池，查看 pickup 卡牌与概率",
};

export default function GachaPage() {
    return <GachaContent />;
}
