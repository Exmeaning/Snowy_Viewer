
import { Metadata } from "next";
import MusicContent from "./client";

export const metadata: Metadata = {
    title: "音乐图鉴",
    description: "浏览 Project Sekai 全部歌曲，查看谱面难度、作曲信息",
};

export default function MusicPage() {
    return <MusicContent />;
}
