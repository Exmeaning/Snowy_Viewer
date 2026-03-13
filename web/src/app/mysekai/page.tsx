
import { Metadata } from "next";
import MysekaiClient from "./client";

export const metadata: Metadata = {
    title: "家具图鉴",
    description: "浏览 Project Sekai MySEKAI 家具图鉴",
};

export default function MysekaiPage() {
    return <MysekaiClient />;
}
