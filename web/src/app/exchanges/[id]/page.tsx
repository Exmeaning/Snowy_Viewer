import { Suspense } from "react";
import { getExchangeMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import { formatExchangeShopSuffix } from "@/lib/seo-keywords";
import ExchangeDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "exchange",
    routePrefix: "exchanges",
    getData: getExchangeMeta,
    fallbackTwitterCard: "summary",
    build: (exchange, { locale }) => ({
        title: exchange.summaryName && exchange.summaryName !== exchange.name
            ? `${exchange.name} - ${exchange.summaryName}`
            : exchange.name,
        descriptionKind: "exchange",
        descriptionValues: {
            name: exchange.name,
            shopSuffix: formatExchangeShopSuffix(exchange.summaryName, locale),
        },
        twitterCard: "summary",
    }),
});

export default function ExchangeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <ExchangeDetailClient />
        </Suspense>
    );
}
