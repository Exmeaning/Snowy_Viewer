import type { Metadata } from "next";
import BreadcrumbCommunityClient from "./client";

export const metadata: Metadata = {
    title: "社区",
};

export default function Page() {
    return <BreadcrumbCommunityClient />;
}
