import { Metadata } from "next";
import ScoreControlClient from "./client";

export const metadata: Metadata = {
    title: "控分计算器",
    description: "Project Sekai 控分计算器",
};

export default function ScoreControlPage() {
    return <ScoreControlClient />;
}
