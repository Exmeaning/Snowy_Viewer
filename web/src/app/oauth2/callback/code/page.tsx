import { Suspense } from "react";
import CallbackClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("oauth2_callback");

export default function OAuth2CallbackCodePage() {
    return (
        <Suspense fallback={null}>
            <CallbackClient />
        </Suspense>
    );
}
