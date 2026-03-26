"use client";
import BreadcrumbGroupPage from "@/components/BreadcrumbGroupPage";
import { navigationGroups } from "@/lib/navigation";

const group = navigationGroups.find((g) => g.href === "/breadcrumb-database")!;

export default function BreadcrumbDatabaseClient() {
    return <BreadcrumbGroupPage group={group} />;
}
