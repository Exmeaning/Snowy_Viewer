import type { Metadata } from "next";
import StorySelfListClient from "./client";

export const metadata: Metadata = { title: "自我介绍", description: "浏览 Project Sekai 角色自我介绍" };

export default function StorySelfListPage() {
    return <StorySelfListClient />;
}
