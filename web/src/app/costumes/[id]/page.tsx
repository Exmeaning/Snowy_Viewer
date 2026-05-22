import { Metadata } from "next";
import { Suspense } from "react";
import { getCostumeMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription, getDetailFallbackTitle } from "@/lib/seo-keywords";
import CostumeDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const costume = getCostumeMeta(Number(id));
    if (!costume) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("costume", locale),
            description: getDetailFallbackTitle("costume", locale),
            path: `/costumes/${id}`,
        });
    }

    const title = costume.name;
    const description = formatDetailSeoDescription("costume", { name: costume.name }, locale);

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/costumes/${id}`,
        twitterCard: "summary",
    });
}

export default function CostumeDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <CostumeDetailClient />
        </Suspense>
    );
}
