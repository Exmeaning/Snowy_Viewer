import { Metadata } from "next";
import { Suspense } from "react";
import { getEventMeta } from "@/lib/metadata";
import StoryReaderClient from "./client";

type Props = { params: Promise<{ id: string; episodeNo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id, episodeNo } = await params;
    const event = getEventMeta(Number(id));
    if (!event) return { title: "故事阅读" };

    const title = `${event.name} 第${episodeNo}话`;
    const description = `Project Sekai「${event.name}」活动故事 第${episodeNo}话`;

    return {
        title,
        description,
        openGraph: { title, description },
        twitter: { card: "summary", title, description },
    };
}

export default function StoryEpisodePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <StoryReaderClient />
        </Suspense>
    );
}
