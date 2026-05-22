import ExchangesClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("exchanges");

export default function ExchangesPage() {
    return <ExchangesClient />;
}
