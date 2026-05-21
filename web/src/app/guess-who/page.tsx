
import { Metadata } from "next";
import GuessWhoClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Guess Who",
    description: "Project Sekai character guessing game" + SEO_SUFFIX,
    keywords: getPageKeywords("guess_who"),
};

export default function GuessWhoPage() {
    return <GuessWhoClient />;
}
