
import { Metadata } from "next";
import GuessWhoClient from "./client";

export const metadata: Metadata = {
    title: "我是谁",
    description: "Project Sekai 猜角色小游戏",
};

export default function GuessWhoPage() {
    return <GuessWhoClient />;
}
