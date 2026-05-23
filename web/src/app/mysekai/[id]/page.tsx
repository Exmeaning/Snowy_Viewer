import { Suspense } from "react";
import { mysekaiFixtureDetailMetadata } from "@/lib/seo-detail-metadata";
import MysekaiFixtureDetailClient from "./client";

export const generateMetadata = mysekaiFixtureDetailMetadata;

export default function MysekaiFixtureDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MysekaiFixtureDetailClient />
        </Suspense>
    );
}
