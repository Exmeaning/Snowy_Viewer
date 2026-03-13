
import { Metadata } from "next";
import VirtualLiveContent from "./client";

export const metadata: Metadata = {
    title: "演唱会",
    description: "浏览 Project Sekai 虚拟 Live 演唱会信息",
};

export default function LivePage() {
    return <VirtualLiveContent />;
}
