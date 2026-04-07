import { Metadata } from "next";
import MaterialsClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - 持有物图鉴",
    description: "浏览 Project Sekai 持有物与 MySekai 持有物图鉴",
};

export default function MaterialsPage() {
    return <MaterialsClient />;
}
