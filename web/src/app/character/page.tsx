import CharacterListContent from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("character");

export default function CharacterPage() {
    return <CharacterListContent />;
}
