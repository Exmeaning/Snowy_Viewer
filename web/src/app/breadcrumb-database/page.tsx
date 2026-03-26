import type { Metadata } from "next";
import BreadcrumbDatabaseClient from "./client";

export const metadata: Metadata = {
    title: "数据库",
};

export default function Page() {
    return <BreadcrumbDatabaseClient />;
}
