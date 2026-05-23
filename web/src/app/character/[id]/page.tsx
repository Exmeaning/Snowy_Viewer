import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import { characterDetailMetadata } from "@/lib/seo-detail-metadata";
import CharacterDetailClient from "./client";

export const generateMetadata = characterDetailMetadata;

export default function CharacterDetailPage() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">Loading character details...</div>}>
                <CharacterDetailClient />
            </Suspense>
        </MainLayout>
    );
}
