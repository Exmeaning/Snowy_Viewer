
import { Metadata } from "next";
import CostumesClient from "./client";

export const metadata: Metadata = {
    title: "服装图鉴",
    description: "浏览 Project Sekai 全部服装图鉴",
};

export default function CostumesPage() {
    return <CostumesClient />;
}
