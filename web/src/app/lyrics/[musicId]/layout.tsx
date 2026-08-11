import type { ReactNode } from "react";

import { fetchLyricsDocument, isLyricsUnavailableError } from "@/lib/lyrics";
import { defineLyricsDetailClientPage } from "@/lib/seo-detail-metadata";
import { createDetailFallbackMetadata } from "@/lib/seo-metadata";
import LyricsDetailClient from "./client";

interface LyricsDetailLayoutProps {
    children: ReactNode;
    params: Promise<{ musicId: string }>;
}

const Page = defineLyricsDetailClientPage(LyricsDetailClient);

function parseCanonicalMusicId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const musicId = Number(value);
    return Number.isSafeInteger(musicId) ? musicId : null;
}

async function hasAvailableLyrics(musicId: number): Promise<boolean> {
    if (!Number.isInteger(musicId) || musicId <= 0) return false;
    try {
        await fetchLyricsDocument(musicId);
        return true;
    } catch (error) {
        if (isLyricsUnavailableError(error)) return false;
        throw error;
    }
}

export async function generateMetadata({ params }: Pick<LyricsDetailLayoutProps, "params">) {
    const { musicId } = await params;
    const canonicalMusicId = parseCanonicalMusicId(musicId);
    if (canonicalMusicId === null || !await hasAvailableLyrics(canonicalMusicId)) {
        return createDetailFallbackMetadata("lyrics", `/lyrics/${musicId}`, "summary");
    }

    return Page.generateMetadata({ params: Promise.resolve({ id: String(canonicalMusicId) }) });
}

export default function LyricsDetailLayout({ children }: LyricsDetailLayoutProps) {
    return children;
}
