import { Metadata } from "next";
import MultiplayerClient from "./client";

export const metadata: Metadata = {
    title: "联机模式 猜曲绘",
    description: "Project Sekai 猜曲绘联机对战",
};

export default function MultiplayerPage() {
    return <MultiplayerClient />;
}
