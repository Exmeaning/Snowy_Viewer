
import { Metadata } from "next";
import CardsClient from "./client";

export const metadata: Metadata = {
    title: "卡牌图鉴",
    description: "浏览 Project Sekai 全部卡牌，支持按角色、稀有度、属性筛选",
};

export default function CardsPage() {
    return <CardsClient />;
}
