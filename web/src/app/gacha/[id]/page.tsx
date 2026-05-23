import { Suspense } from "react";
import { gachaDetailMetadata } from "@/lib/seo-detail-metadata";
import GachaDetailClient from "./client";

export const generateMetadata = gachaDetailMetadata;

export default function GachaDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <GachaDetailClient />
        </Suspense>
    );
}
