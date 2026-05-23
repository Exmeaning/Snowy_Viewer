import { Suspense } from "react";
import { eventDetailMetadata } from "@/lib/seo-detail-metadata";
import EventDetailClient from "./client";

export const generateMetadata = eventDetailMetadata;

export default function EventDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <EventDetailClient />
        </Suspense>
    );
}
