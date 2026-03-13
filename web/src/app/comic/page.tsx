
import { Metadata } from "next";
import ComicContent from "./client";

export const metadata: Metadata = {
    title: "漫画图鉴",
    description: "浏览 Project Sekai 官方一格漫画",
};

export default function ComicPage() {
    return <ComicContent />;
}
