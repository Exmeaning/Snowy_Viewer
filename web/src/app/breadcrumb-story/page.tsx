import BreadcrumbStoryClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("breadcrumb_story");

export default function Page() {
    return <BreadcrumbStoryClient />;
}
