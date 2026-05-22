import MultiplayerClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("guess_jacket_multiplayer");

export default function MultiplayerPage() {
    return <MultiplayerClient />;
}
