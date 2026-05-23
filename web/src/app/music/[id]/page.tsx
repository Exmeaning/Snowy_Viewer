import { Suspense } from "react";
import { defineMusicDetailPage } from "@/lib/seo-detail-metadata";
import MusicDetailClient from "./client";

function MusicDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MusicDetailClient />
        </Suspense>
    );
}

const Page = defineMusicDetailPage(MusicDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
