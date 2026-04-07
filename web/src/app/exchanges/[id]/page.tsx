import { Metadata } from "next";
import { Suspense } from "react";
import { getExchangeMeta } from "@/lib/metadata";
import ExchangeDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const exchange = getExchangeMeta(Number(id));

    if (!exchange) {
        return {
            title: "兑换所详情",
            description: "Project Sekai 兑换所条目详情",
        };
    }

    const title = exchange.summaryName && exchange.summaryName !== exchange.name
        ? `${exchange.name} - ${exchange.summaryName}`
        : exchange.name;
    const description = `Project Sekai 兑换所条目「${exchange.name}」${exchange.summaryName ? `，所属兑换所：${exchange.summaryName}` : ""}`;

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
