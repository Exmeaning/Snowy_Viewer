import { Metadata } from "next";
import HonorsClient from "./client";

export const metadata: Metadata = {
    title: "称号成就",
    description: "浏览 Project Sekai 称号成就图鉴",
};

export default function HonorsPage() {
    return <HonorsClient />;
}
