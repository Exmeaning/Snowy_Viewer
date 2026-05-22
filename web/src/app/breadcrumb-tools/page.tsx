import BreadcrumbToolsClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("breadcrumb_tools");

export default function Page() {
    return <BreadcrumbToolsClient />;
}
