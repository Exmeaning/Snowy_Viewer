
import { Metadata } from "next";
import PredictionClient from "./client";
import { enUSMessages } from "@/lib/i18n/messages/en-US";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: enUSMessages.layout.nav.items.prediction,
    description: enUSMessages.layout.groupPages.prediction + SEO_SUFFIX,
    keywords: getPageKeywords("prediction"),
};

export default function PredictionPage() {
    return <PredictionClient />;
}
