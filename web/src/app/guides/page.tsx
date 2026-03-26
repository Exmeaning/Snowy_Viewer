import { Metadata } from "next";
import GuidesClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - 攻略",
    description: "PROJECT SEKAI 攻略合集",
};

export default function GuidesPage() {
    return <GuidesClient />;
}
