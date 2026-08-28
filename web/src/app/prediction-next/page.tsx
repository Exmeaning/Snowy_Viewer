import PredictionNextClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("prediction_next");

export default function PredictionNextPage() {
    return <PredictionNextClient />;
}
