import BreadcrumbGamesClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("breadcrumb_games");

export default function Page() {
    return <BreadcrumbGamesClient />;
}
