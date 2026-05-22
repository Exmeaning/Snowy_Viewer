import { Metadata } from "next";
import GuideDetailClient from "./client";

export const metadata: Metadata = {
    title: "Guide Details",
};

export default function GuideDetailPage() {
    return <GuideDetailClient />;
}
