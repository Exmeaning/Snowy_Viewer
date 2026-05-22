import ScoreControlClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("score_control");

export default function ScoreControlPage() {
    return <ScoreControlClient />;
}
