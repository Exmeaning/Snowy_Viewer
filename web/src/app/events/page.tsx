
import { Metadata } from "next";
import EventsContent from "./client";

export const metadata: Metadata = {
    title: "活动图鉴",
    description: "浏览 Project Sekai 全部活动，查看活动详情与排名",
};

export default function EventsPage() {
    return <EventsContent />;
}
