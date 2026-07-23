import PrivacyPolicyClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("privacy");

export default function PrivacyPolicyPage() {
    return <PrivacyPolicyClient />;
}
