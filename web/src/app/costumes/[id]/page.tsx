import { Suspense } from "react";
import { costumeDetailMetadata } from "@/lib/seo-detail-metadata";
import CostumeDetailClient from "./client";

export const generateMetadata = costumeDetailMetadata;

export default function CostumeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CostumeDetailClient />
        </Suspense>
    );
}
