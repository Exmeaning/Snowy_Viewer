import { Metadata } from "next";
import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import { getCharacterMeta } from "@/lib/metadata";
import { DETAIL_SEO_SUFFIX } from "@/lib/seo-keywords";
import { getCharacterIconUrl } from "@/lib/assets";
import CharacterDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const character = getCharacterMeta(Number(id));
    if (!character) return { title: "Character Details" };

    const title = character.name;
    const description = `Detailed information for Project Sekai character "${character.name}"` + DETAIL_SEO_SUFFIX;
    const ogImage = getCharacterIconUrl(Number(id));

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary", title, description, images: [ogImage] },
    };
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
