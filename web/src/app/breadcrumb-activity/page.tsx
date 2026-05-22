import type { Metadata } from "next";
import BreadcrumbActivityClient from "./client";

export const metadata: Metadata = {
    title: "Activity",
};

export default function Page() {
    return <BreadcrumbActivityClient />;
}
