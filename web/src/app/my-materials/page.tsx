import { Metadata } from "next";
import MyMaterialsClient from "./client";

export const metadata: Metadata = {
    title: "资源查询",
    description: "Project Sekai 玩家资源与材料查询",
};

export default function MyMaterialsPage() {
    return <MyMaterialsClient />;
}
