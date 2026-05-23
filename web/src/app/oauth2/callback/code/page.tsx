import { Suspense } from "react";
import CallbackClient from "./client";
import { noIndexPageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = noIndexPageMetadata("oauth2_callback");

export default function OAuth2CallbackCodePage() {
    return (
        <Suspense fallback={null}>
            <CallbackClient />
        </Suspense>
    );
}
