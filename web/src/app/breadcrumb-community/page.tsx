import BreadcrumbCommunityClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("breadcrumb_community");

export default function Page() {
    return <BreadcrumbCommunityClient />;
}
