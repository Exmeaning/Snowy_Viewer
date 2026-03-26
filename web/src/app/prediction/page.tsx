
import { Metadata } from "next";
import PredictionClient from "./client";

export const metadata: Metadata = {
    title: "活动预测",
    description: "Project Sekai 活动排名预测工具",
};

export default function PredictionPage() {
    return <PredictionClient />;
}
