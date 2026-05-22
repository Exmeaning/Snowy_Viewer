import { Metadata } from "next";
import SoundtrackContent from "./client";
import { enUSMessages } from "@/lib/i18n/messages/en-US";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: enUSMessages.layout.nav.items.soundtrack,
    description: enUSMessages.layout.groupPages.soundtrack + SEO_SUFFIX,
    keywords: getPageKeywords("soundtrack"),
};

export default function SoundtrackPage() {
    return <SoundtrackContent />;
}
