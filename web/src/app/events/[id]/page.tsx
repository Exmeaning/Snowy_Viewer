import { Suspense } from "react";
import { IEventInfo } from "@/types/events";
import EventDetailClient from "./client";

const EVENTS_DATA_URL = "https://sekaimaster.exmeaning.com/master/events.json";

export async function generateStaticParams() {
    try {
        const events: IEventInfo[] = await fetch(EVENTS_DATA_URL).then((res) => res.json());
        return events.map((event) => ({
            id: event.id.toString(),
        }));
    } catch (e) {
        console.error("Error generating static params for events:", e);
        return [];
    }
}

export default function EventDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <EventDetailClient />
        </Suspense>
    );
}
