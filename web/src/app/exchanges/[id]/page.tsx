import { Metadata } from "next";
import { Suspense } from "react";
import { getExchangeMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import {
    formatDetailSeoDescription,
    formatExchangeShopSuffix,
    getDetailFallbackTitle,
} from "@/lib/seo-keywords";
import ExchangeDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const exchange = getExchangeMeta(Number(id));
    const path = `/exchanges/${id}`;

    if (!exchange) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("exchange", locale),
            description: formatDetailSeoDescription("exchangeFallback", {}, locale),
            path,
            twitterCard: "summary",
        });
    }

    const title = exchange.summaryName && exchange.summaryName !== exchange.name
        ? `${exchange.name} - ${exchange.summaryName}`
        : exchange.name;
    const description = formatDetailSeoDescription(
        "exchange",
        {
            name: exchange.name,
            shopSuffix: formatExchangeShopSuffix(exchange.summaryName, locale),
        },
        locale,
    );

    return buildDetailMetadata({
        locale,
        title,
        description,
        path,
        twitterCard: "summary",
    });
}

export default function ExchangeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <ExchangeDetailClient />
        </Suspense>
    );
}
