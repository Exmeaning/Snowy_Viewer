import { Metadata } from "next";
import MultiplayerClient from "./client";

export const metadata: Metadata = {
    title: "Snowy SekaiViewer - 联机模式 我是谁",
    description: "多人联机猜卡面小游戏 - 与好友实时对战",
};

export default function MultiplayerPage() {
    return <MultiplayerClient />;
}
