import MyCardsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("my_cards");

export default function MyCardsPage() {
    return <MyCardsClient />;
}
