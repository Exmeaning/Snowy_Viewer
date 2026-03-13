
import { Metadata } from "next";
import MusicMetaClient from "./client";

export const metadata: Metadata = {
    title: "歌曲Meta",
    description: "Project Sekai 歌曲效率数据与排行",
};

export default function MusicMetaPage() {
    return <MusicMetaClient />;
}
