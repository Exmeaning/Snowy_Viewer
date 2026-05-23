import { Suspense } from "react";
import CardDetailClient from "./client";
import { defineCardDetailPage } from "@/lib/seo-detail-metadata";

function CardDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CardDetailClient />
        </Suspense>
    );
}

const Page = defineCardDetailPage(CardDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
