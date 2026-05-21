import { Metadata } from "next";
import { Suspense } from "react";
import ProfileClient from "./client";
import { getPageKeywords, SEO_SUFFIX } from "@/lib/seo-keywords";

export const metadata: Metadata = {
    title: "My Profile",
    description: "Moesekai user profile and connected account management" + SEO_SUFFIX,
    keywords: getPageKeywords("profile"),
};

export default function ProfilePage() {
    return (
        <Suspense fallback={null}>
            <ProfileClient />
        </Suspense>
    );
}
