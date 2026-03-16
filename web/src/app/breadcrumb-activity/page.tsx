import type { Metadata } from "next";
import BreadcrumbActivityClient from "./client";

export const metadata: Metadata = {
    title: "活动",
};

export default function Page() {
    return <BreadcrumbActivityClient />;
}
