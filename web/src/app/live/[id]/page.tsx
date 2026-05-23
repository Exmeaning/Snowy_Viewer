import { Suspense } from "react";
import { defineLiveDetailPage } from "@/lib/seo-detail-metadata";
import VirtualLiveDetailClient from "./client";

function VirtualLiveDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <VirtualLiveDetailClient />
        </Suspense>
    );
}

const Page = defineLiveDetailPage(VirtualLiveDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
