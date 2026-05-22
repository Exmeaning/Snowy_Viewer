import { Metadata } from "next";
import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import { getCharacterMeta } from "@/lib/metadata";
import { buildDetailMetadata, getRequestSeoLocale } from "@/lib/seo-metadata";
import { formatDetailSeoDescription, getDetailFallbackTitle } from "@/lib/seo-keywords";
import { getCharacterIconUrl } from "@/lib/assets";
import CharacterDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const locale = await getRequestSeoLocale();
    const character = getCharacterMeta(Number(id));
    if (!character) {
        return buildDetailMetadata({
            locale,
            title: getDetailFallbackTitle("character", locale),
            description: getDetailFallbackTitle("character", locale),
            path: `/character/${id}`,
        });
    }

    const title = character.name;
    const description = formatDetailSeoDescription("character", { name: character.name }, locale);
    const ogImage = getCharacterIconUrl(Number(id));

    return buildDetailMetadata({
        locale,
        title,
        description,
        path: `/character/${id}`,
        images: [ogImage],
        twitterCard: "summary",
    });
}

export default function CharacterDetailPage() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">Loading character details...</div>}>
                <CharacterDetailClient />
            </Suspense>
        </MainLayout>
    );
}
