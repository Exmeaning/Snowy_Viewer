import type { Metadata } from "next";
import { Suspense } from "react";
import CallbackClient from "./client";

export const metadata: Metadata = {
    title: "OAuth2 Callback",
};

export default function OAuth2CallbackCodePage() {
    return (
        <Suspense fallback={null}>
            <CallbackClient />
        </Suspense>
    );
}
