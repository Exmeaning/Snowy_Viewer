import { Metadata } from "next";
import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import { getCharacterMeta } from "@/lib/metadata";
import CharacterDetailClient from "./client";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const character = getCharacterMeta(Number(id));
    if (!character) return { title: "角色详情" };

    const title = character.name;
    const description = `Project Sekai 角色「${character.name}」详细信息`;
    const ogImage = `https://assets.exmeaning.com/character_icons/chr_ts_${id}.png`;

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
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载角色详情...</div>}>
                <CharacterDetailClient />
            </Suspense>
        </MainLayout>
    );
}
