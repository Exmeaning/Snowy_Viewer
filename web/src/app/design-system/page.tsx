import type { Metadata } from "next";

import { noIndexRobots } from "@/lib/seo-metadata";
import DesignSystemClient from "./client";

export const metadata: Metadata = {
    title: "Design System",
    robots: noIndexRobots(),
};

export default function DesignSystemPage() {
    return <DesignSystemClient />;
}
