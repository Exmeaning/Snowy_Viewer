import AboutClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("about");

export default function AboutPage() {
    return <AboutClient />;
}
