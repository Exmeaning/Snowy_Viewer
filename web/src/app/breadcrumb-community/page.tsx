import type { Metadata } from "next";
import BreadcrumbCommunityClient from "./client";

export const metadata: Metadata = {
    title: "Community",
};

export default function Page() {
    return <BreadcrumbCommunityClient />;
}
