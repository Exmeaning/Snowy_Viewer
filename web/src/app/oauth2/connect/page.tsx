import type { Metadata } from "next";
import { Suspense } from "react";
import ConnectClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - OAuth2 授权绑定",
};

export default function OAuth2ConnectPage() {
    return (
        <Suspense fallback={null}>
            <ConnectClient />
        </Suspense>
    );
}
