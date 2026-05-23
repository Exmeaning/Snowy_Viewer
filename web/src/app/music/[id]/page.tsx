import { Suspense } from "react";
import { getMusicJacketUrl } from "@/lib/assets";
import { getMusicMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import MusicDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "music",
    routePrefix: "music",
    getData: getMusicMeta,
    build: (music) => ({
        title: music.title,
        descriptionKind: "music",
        descriptionValues: { title: music.title, lyricist: music.lyricist, composer: music.composer },
        images: [getMusicJacketUrl(music.asset, "main-jp")],
        twitterCard: "summary",
    }),
});

export default function MusicDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MusicDetailClient />
        </Suspense>
    );
}
