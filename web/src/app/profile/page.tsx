import { Metadata } from "next";
import ProfileClient from "./client";

export const metadata: Metadata = {
    title: "我的主页",
    description: "Moesekai 个人主页",
};

export default function ProfilePage() {
    return <ProfileClient />;
}
