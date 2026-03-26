import { Metadata } from "next";
import GuideDetailClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - 攻略详情",
};

export default function GuideDetailPage() {
    return <GuideDetailClient />;
}
