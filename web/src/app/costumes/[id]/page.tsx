import { Suspense } from "react";
import { defineCostumeDetailPage } from "@/lib/seo-detail-metadata";
import CostumeDetailClient from "./client";

function CostumeDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CostumeDetailClient />
        </Suspense>
    );
}

const Page = defineCostumeDetailPage(CostumeDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
