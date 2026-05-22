import { Suspense } from "react";
import ProfileClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("profile");

export default function ProfilePage() {
    return (
        <Suspense fallback={null}>
            <ProfileClient />
        </Suspense>
    );
}
