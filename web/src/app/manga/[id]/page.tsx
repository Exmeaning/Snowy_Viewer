import { Suspense } from "react";
import { defineMangaDetailPage } from "@/lib/seo-detail-metadata";
import MangaDetailClient from "./client";

function MangaDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MangaDetailClient />
        </Suspense>
    );
}

const Page = defineMangaDetailPage(MangaDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
