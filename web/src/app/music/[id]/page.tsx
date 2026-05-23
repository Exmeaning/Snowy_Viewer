import { Suspense } from "react";
import { musicDetailMetadata } from "@/lib/seo-detail-metadata";
import MusicDetailClient from "./client";

export const generateMetadata = musicDetailMetadata;

export default function MusicDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MusicDetailClient />
        </Suspense>
    );
}
