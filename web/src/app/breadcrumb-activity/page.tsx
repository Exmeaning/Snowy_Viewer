import BreadcrumbActivityClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("breadcrumb_activity");

export default function Page() {
    return <BreadcrumbActivityClient />;
}
