import { Suspense } from "react";
import { defineGachaDetailPage } from "@/lib/seo-detail-metadata";
import GachaDetailClient from "./client";

function GachaDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <GachaDetailClient />
        </Suspense>
    );
}

const Page = defineGachaDetailPage(GachaDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
