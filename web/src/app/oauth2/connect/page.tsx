import { Suspense } from "react";
import ConnectClient from "./client";
import { pageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = pageMetadata("oauth2_connect");

export default function OAuth2ConnectPage() {
    return (
        <Suspense fallback={null}>
            <ConnectClient />
        </Suspense>
    );
}
