
import { Metadata } from "next";
import EventsContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "活动图鉴",
    description: "浏览 Project Sekai 全部活动，查看活动详情与排名" + SEO_SUFFIX,
    keywords: getPageKeywords("events"),
};

export default function EventsPage() {
    return <EventsContent />;
}
