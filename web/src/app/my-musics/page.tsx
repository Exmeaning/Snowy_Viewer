import { Metadata } from "next";
import MyMusicsClient from "./client";

export const metadata: Metadata = {
    title: "歌曲进度",
    description: "Project Sekai 歌曲游玩进度追踪",
};

export default function MyMusicsPage() {
    return <MyMusicsClient />;
}
