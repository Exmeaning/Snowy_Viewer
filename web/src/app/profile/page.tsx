import { Metadata } from "next";
import { Suspense } from "react";
import ProfileClient from "./client";

export const metadata: Metadata = {
    title: "Moesekai - 我的主页",
    description: "Moesekai 个人主页",
};

export default function ProfilePage() {
    return (
        <Suspense fallback={null}>
            <ProfileClient />
        </Suspense>
    );
}
