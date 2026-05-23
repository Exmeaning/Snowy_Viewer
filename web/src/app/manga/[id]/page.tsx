import { Suspense } from "react";
import { mangaDetailMetadata } from "@/lib/seo-detail-metadata";
import MangaDetailClient from "./client";

export const generateMetadata = mangaDetailMetadata;

export default function MangaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MangaDetailClient />
        </Suspense>
    );
}
