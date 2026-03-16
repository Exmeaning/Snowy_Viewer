"use client";
import BreadcrumbGroupPage from "@/components/BreadcrumbGroupPage";
import { navigationGroups } from "@/lib/navigation";

const group = navigationGroups.find((g) => g.href === "/breadcrumb-community")!;

export default function BreadcrumbCommunityClient() {
    return <BreadcrumbGroupPage group={group} />;
}
