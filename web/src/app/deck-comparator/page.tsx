import { Metadata } from "next";
import DeckComparatorClient from "./client";

export const metadata: Metadata = {
    title: "组卡比较器",
    description: "Project Sekai 组卡比较器",
};

export default function DeckComparatorPage() {
    return <DeckComparatorClient />;
}
