import { Metadata } from "next";
import AboutClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "About",
    description: "About Moesekai (formerly Snowy SekaiViewer)" + SEO_SUFFIX,
    keywords: getPageKeywords("about"),
};

export default function AboutPage() {
    return <AboutClient />;
}
