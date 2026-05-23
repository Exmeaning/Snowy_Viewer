import { Suspense } from "react";
import MainLayout from "@/components/MainLayout";
import { getCharacterIconUrl } from "@/lib/assets";
import { getCharacterMeta } from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import CharacterDetailClient from "./client";

export const generateMetadata = dynamicDetailMetadata({
    kind: "character",
    routePrefix: "character",
    getData: getCharacterMeta,
    build: (character, { numericId }) => ({
        title: character.name,
        descriptionKind: "character",
        descriptionValues: { name: character.name },
        images: [getCharacterIconUrl(numericId)],
        twitterCard: "summary",
    }),
});

export default function CharacterDetailPage() {
    return (
        <MainLayout>
            <Suspense fallback={<div className="flex h-[50vh] w-full items-center justify-center text-slate-500">Loading character details...</div>}>
                <CharacterDetailClient />
            </Suspense>
        </MainLayout>
    );
}
