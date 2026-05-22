import PredictionClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("prediction");

export default function PredictionPage() {
    return <PredictionClient />;
}
