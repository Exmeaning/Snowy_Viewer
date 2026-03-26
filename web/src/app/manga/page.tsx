
import { Metadata } from "next";
import MangaClient from "./client";

export const metadata: Metadata = {
    title: "官方四格",
    description: "浏览 Project Sekai 官方四格漫画",
};

export default function MangaPage() {
    return <MangaClient />;
}
