import { Suspense } from "react";
import { exchangeDetailMetadata } from "@/lib/seo-detail-metadata";
import ExchangeDetailClient from "./client";

export const generateMetadata = exchangeDetailMetadata;

export default function ExchangeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <ExchangeDetailClient />
        </Suspense>
    );
}
