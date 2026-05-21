
import { Metadata } from "next";
import CharacterListContent from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "Character Encyclopedia",
    description: "Browse all Project Sekai character profiles and detailed information" + SEO_SUFFIX,
    keywords: getPageKeywords("character"),
};

export default function CharacterPage() {
    return <CharacterListContent />;
}
