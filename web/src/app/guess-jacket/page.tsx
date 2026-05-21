import { Metadata } from "next";
import GuessJacketClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Guess Jacket",
    description: "Project Sekai music jacket guessing game" + SEO_SUFFIX,
    keywords: getPageKeywords("guess_jacket"),
};

export default function GuessJacketPage() {
    return <GuessJacketClient />;
}
