import React from "react";
import type { Metadata } from "next";
import BackgroundPattern from "@/components/BackgroundPattern";

export const metadata: Metadata = {
    title: "空白素材页",
};

export default function BlankPage() {
    return (
        <main className="min-h-screen relative selection:bg-miku selection:text-white font-sans flex flex-col">
            <BackgroundPattern />
        </main>
    );
}
