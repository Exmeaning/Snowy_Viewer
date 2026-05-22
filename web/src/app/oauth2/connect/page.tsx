import type { Metadata } from "next";
import { Suspense } from "react";
import ConnectClient from "./client";

export const metadata: Metadata = {
    title: "OAuth2 Connect",
};

export default function OAuth2ConnectPage() {
    return (
        <Suspense fallback={null}>
            <ConnectClient />
        </Suspense>
    );
}
