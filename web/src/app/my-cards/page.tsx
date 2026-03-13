import { Metadata } from "next";
import MyCardsClient from "./client";

export const metadata: Metadata = {
    title: "卡牌进度",
    description: "Project Sekai 卡牌收集进度追踪",
};

export default function MyCardsPage() {
    return <MyCardsClient />;
}
