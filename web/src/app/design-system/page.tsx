import { noIndexRouteMetadata } from "@/lib/seo-metadata";
import DesignSystemClient from "./client";

export const generateMetadata = noIndexRouteMetadata("/design-system", "Design System");

export default function DesignSystemPage() {
    return <DesignSystemClient />;
}
