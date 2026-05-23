import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import { defineCharacterDetailPage } from "@/lib/seo-detail-metadata";
import CharacterDetailClient from "./client";

function CharacterDetailPage(_: { params?: Promise<{ id: string }> }) {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">Loading character details...</div>}>
                <CharacterDetailClient />
            </Suspense>
        </MainLayout>
    );
}

const Page = defineCharacterDetailPage(CharacterDetailPage);
export const generateMetadata = Page.generateMetadata;
export default Page;
