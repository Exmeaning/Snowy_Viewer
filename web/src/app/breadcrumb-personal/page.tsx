import type { Metadata } from "next";
import BreadcrumbPersonalClient from "./client";

export const metadata: Metadata = {
    title: "个人",
};

export default function Page() {
    return <BreadcrumbPersonalClient />;
}
