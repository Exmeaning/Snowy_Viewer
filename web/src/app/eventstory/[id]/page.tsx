import { Metadata } from "next";
import { Suspense } from "react";
import { getEventMeta } from "@/lib/metadata";
import EventStorySummaryClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const event = getEventMeta(Number(id));
    if (!event) return { title: "活动故事" };

    const title = `${event.name} - 活动故事`;
    const description = `Project Sekai「${event.name}」活动剧情`;

    return {
        title,
        description,
        openGraph: { title, description },
        twitter: { card: "summary", title, description },
    };
}

export default function EventStorySummaryPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <EventStorySummaryClient />
        </Suspense>
    );
}
