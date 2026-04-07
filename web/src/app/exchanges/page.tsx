import { Metadata } from "next";
import ExchangesClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - 兑换所",
    description: "浏览 Project Sekai 数据库中的兑换所与兑换项信息",
};

export default function ExchangesPage() {
    return <ExchangesClient />;
}
