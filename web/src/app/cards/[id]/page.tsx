import { Suspense } from "react";
import CardDetailClient from "./client";
import { cardDetailMetadata } from "@/lib/seo-detail-metadata";

export const generateMetadata = cardDetailMetadata;

export default function CardDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CardDetailClient />
        </Suspense>
    );
}
