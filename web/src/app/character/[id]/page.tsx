import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import CharacterDetailClient from "./client";
import { fetchMasterData } from "@/lib/fetch";
import { IGameChara } from "@/types/types";

// Generate static params for all characters
export async function generateStaticParams() {
    try {
        const characters = await fetchMasterData<IGameChara[]>("gameCharacters.json");
        return characters.map((chara) => ({
            id: chara.id.toString(),
        }));
    } catch (e) {
        console.error("Error generating static params for characters:", e);
        return [];
    }
}

export default async function CharacterDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <MainLayout activeNav="角色">
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">正在加载角色详情...</div>}>
                <CharacterDetailClient characterId={id} />
            </Suspense>
        </MainLayout>
    );
}
