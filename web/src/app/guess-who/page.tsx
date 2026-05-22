import GuessWhoClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("guess_who");

export default function GuessWhoPage() {
    return <GuessWhoClient />;
}
