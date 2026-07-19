import { Suspense } from "react";

import { pageMetadata } from "@/lib/seo-metadata";

import ProfileCardClient from "./client";

export const generateMetadata = pageMetadata("profile_card");

export default function ProfileCardPage() {
    return (
        <Suspense>
            <ProfileCardClient />
        </Suspense>
    );
}
