import BreadcrumbPersonalClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("breadcrumb_personal");

export default function Page() {
    return <BreadcrumbPersonalClient />;
}
