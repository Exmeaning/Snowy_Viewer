import { Metadata } from "next";
import MyMusicsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Music Progress",
    description: "Track your Project Sekai song play progress" + SEO_SUFFIX,
    keywords: getPageKeywords("my_musics"),
};

export default function MyMusicsPage() {
    return <MyMusicsClient />;
}
