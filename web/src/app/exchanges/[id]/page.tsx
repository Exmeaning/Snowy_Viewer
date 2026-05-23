import { Suspense } from "react";
import { defineExchangeDetailPage } from "@/lib/seo-detail-metadata";
import ExchangeDetailClient from "./client";

function ExchangeDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <ExchangeDetailClient />
        </Suspense>
    );
}

const Page = defineExchangeDetailPage(ExchangeDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
