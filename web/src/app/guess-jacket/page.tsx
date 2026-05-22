import GuessJacketClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("guess_jacket");

export default function GuessJacketPage() {
    return <GuessJacketClient />;
}
