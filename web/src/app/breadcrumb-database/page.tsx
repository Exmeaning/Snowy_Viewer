import BreadcrumbDatabaseClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("breadcrumb_database");

export default function Page() {
    return <BreadcrumbDatabaseClient />;
}
