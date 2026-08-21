import MainLayout from "@/components/MainLayout";
import { defineCharacterDetailClientPage } from "@/lib/seo-detail-metadata";
import CharacterDetailClient from "./client";

const Page = defineCharacterDetailClientPage(CharacterDetailClient, {
    fallback: <div className="flex h-[50vh] w-full items-center justify-center text-[var(--hh-text-secondary)]">Loading character details...</div>,
    wrap: (children) => <MainLayout>{children}</MainLayout>,
});

export const generateMetadata = Page.generateMetadata;
export default Page;
