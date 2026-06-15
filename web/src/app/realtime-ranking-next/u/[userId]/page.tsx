import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo-metadata";
import UserDetailClient from "./client";

export const metadata: Metadata = {
    title: "Player Detail · Live Ranking Next",
    robots: noIndexRobots(),
};

export default function UserDetailPage() {
    return <UserDetailClient />;
}
