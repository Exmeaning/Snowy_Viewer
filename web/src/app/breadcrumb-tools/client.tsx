"use client";
import BreadcrumbGroupPage from "@/components/BreadcrumbGroupPage";
import { navigationGroups } from "@/lib/navigation";

const group = navigationGroups.find((g) => g.href === "/breadcrumb-tools")!;

export default function BreadcrumbToolsClient() {
    return <BreadcrumbGroupPage group={group} />;
}
