import type { Metadata } from "next";
import BreadcrumbPersonalClient from "./client";

export const metadata: Metadata = {
    title: "Personal",
};

export default function Page() {
    return <BreadcrumbPersonalClient />;
}
