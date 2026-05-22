import CardsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("cards");

export default function CardsPage() {
    return <CardsClient />;
}
