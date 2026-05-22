
import { Metadata } from "next";
import MusicMetaClient from "./client";
import { enUSMessages } from "@/lib/i18n/messages/en-US";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: enUSMessages.layout.nav.items.musicMeta,
    description: enUSMessages.layout.groupPages.musicMeta + SEO_SUFFIX,
    keywords: getPageKeywords("music_meta"),
};

export default function MusicMetaPage() {
    return <MusicMetaClient />;
}
