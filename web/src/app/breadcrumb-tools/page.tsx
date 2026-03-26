import type { Metadata } from "next";
import BreadcrumbToolsClient from "./client";

export const metadata: Metadata = {
    title: "工具",
};

export default function Page() {
    return <BreadcrumbToolsClient />;
}
