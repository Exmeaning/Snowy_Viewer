"use client";
import BreadcrumbGroupPage from "@/components/BreadcrumbGroupPage";
import { navigationGroups } from "@/lib/navigation";

const group = navigationGroups.find((g) => g.href === "/breadcrumb-story")!;

export default function BreadcrumbStoryClient() {
    return <BreadcrumbGroupPage group={group} />;
}
