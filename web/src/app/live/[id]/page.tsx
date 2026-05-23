import { Suspense } from "react";
import { liveDetailMetadata } from "@/lib/seo-detail-metadata";
import VirtualLiveDetailClient from "./client";

export const generateMetadata = liveDetailMetadata;

export default function VirtualLiveDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <VirtualLiveDetailClient />
        </Suspense>
    );
}
