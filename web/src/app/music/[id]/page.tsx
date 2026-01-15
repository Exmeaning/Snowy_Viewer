import { Suspense } from "react";
import { IMusicInfo } from "@/types/music";
import MusicDetailClient from "./client";

const MUSICS_DATA_URL = "https://sekaimaster.exmeaning.com/master/musics.json";

export async function generateStaticParams() {
    try {
        const musics: IMusicInfo[] = await fetch(MUSICS_DATA_URL).then((res) => res.json());
        return musics.map((music) => ({
            id: music.id.toString(),
        }));
    } catch (e) {
        console.error("Error generating static params for musics:", e);
        return [];
    }
}

export default function MusicDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MusicDetailClient />
        </Suspense>
    );
}
