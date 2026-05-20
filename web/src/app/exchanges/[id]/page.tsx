import { Metadata } from "next";
import { Suspense } from "react";
import { getExchangeMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import ExchangeDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const exchange = getExchangeMeta(Number(id));

    if (!exchange) {
        return {
            title: "Exchange Entry Details",
            description: "Project Sekai exchange entry details" + DETAIL_SEO_SUFFIX,
        };
    }

    const title = exchange.summaryName && exchange.summaryName !== exchange.name
        ? `${exchange.name} - ${exchange.summaryName}`
        : exchange.name;
    const description = `Project Sekai exchange entry: ${exchange.name}${exchange.summaryName ? `, exchange shop: ${exchange.summaryName}` : ""}` + DETAIL_SEO_SUFFIX;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
        },
        twitter: {
            card: "summary",
            title,
            description,
        },
    };
}

export default function ExchangeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <ExchangeDetailClient />
        </Suspense>
    );
}
