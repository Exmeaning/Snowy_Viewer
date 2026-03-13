import { Metadata } from "next";
import MultiplayerClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - 联机模式 猜曲绘",
    description: "多人联机猜曲绘小游戏 - 与好友实时对战",
};

export default function MultiplayerPage() {
    return <MultiplayerClient />;
}
