import type { Metadata } from "next";
import BreadcrumbStoryClient from "./client";

export const metadata: Metadata = {
    title: "Story",
};

export default function Page() {
    return <BreadcrumbStoryClient />;
}
