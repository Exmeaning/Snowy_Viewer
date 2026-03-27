import type { Metadata } from "next";
import BreadcrumbStoryClient from "./client";

export const metadata: Metadata = {
    title: "剧情",
};

export default function Page() {
    return <BreadcrumbStoryClient />;
}
