import { Metadata } from "next";
import MyCardsClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Card Progress",
    description: "Track your Project Sekai card collection progress" + SEO_SUFFIX,
    keywords: getPageKeywords("my_cards"),
};

export default function MyCardsPage() {
    return <MyCardsClient />;
}
