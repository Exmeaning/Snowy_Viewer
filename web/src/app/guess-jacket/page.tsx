import { Metadata } from "next";
import GuessJacketClient from "./client";

export const metadata: Metadata = {
    title: "猜曲绘",
    description: "Project Sekai 猜曲绘小游戏",
};

export default function GuessJacketPage() {
    return <GuessJacketClient />;
}
