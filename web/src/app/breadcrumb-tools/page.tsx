import type { Metadata } from "next";
import BreadcrumbToolsClient from "./client";

export const metadata: Metadata = {
    title: "Tools",
};

export default function Page() {
    return <BreadcrumbToolsClient />;
}
