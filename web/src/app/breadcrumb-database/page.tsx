import type { Metadata } from "next";
import BreadcrumbDatabaseClient from "./client";

export const metadata: Metadata = {
    title: "Database",
};

export default function Page() {
    return <BreadcrumbDatabaseClient />;
}
