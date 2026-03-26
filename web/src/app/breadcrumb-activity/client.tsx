"use client";
import BreadcrumbGroupPage from "@/components/BreadcrumbGroupPage";
import { navigationGroups } from "@/lib/navigation";

const group = navigationGroups.find((g) => g.href === "/breadcrumb-activity")!;

export default function BreadcrumbActivityClient() {
    return <BreadcrumbGroupPage group={group} />;
}
