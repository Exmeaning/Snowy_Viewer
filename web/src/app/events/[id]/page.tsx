import { Suspense } from "react";
import { defineEventDetailPage } from "@/lib/seo-detail-metadata";
import EventDetailClient from "./client";

function EventDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <EventDetailClient />
        </Suspense>
    );
}

const Page = defineEventDetailPage(EventDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
