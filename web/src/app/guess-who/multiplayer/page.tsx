import { Metadata } from "next";
import MultiplayerClient from "./client";

export const metadata: Metadata = {
    title: "联机模式 我是谁",
    description: "Project Sekai 猜角色联机对战",
};

export default function MultiplayerPage() {
    return <MultiplayerClient />;
}
