import { Suspense } from "react";
import ConnectClient from "./client";
import { noIndexPageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = noIndexPageMetadata("oauth2_connect");

export default function OAuth2ConnectPage() {
    return (
        <Suspense fallback={null}>
            <ConnectClient />
        </Suspense>
    );
}
