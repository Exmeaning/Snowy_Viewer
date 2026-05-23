import { Suspense } from "react";
import { defineMysekaiFixtureDetailPage } from "@/lib/seo-detail-metadata";
import MysekaiFixtureDetailClient from "./client";

function MysekaiFixtureDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MysekaiFixtureDetailClient />
        </Suspense>
    );
}

const Page = defineMysekaiFixtureDetailPage(MysekaiFixtureDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
