import React from "react";
import type { Metadata } from "next";
import BackgroundPattern from "@/components/BackgroundPattern";

export const metadata: Metadata = {
    title: "Blank Asset Page",
};

export default function BlankPage() {
    return (
        <main className="min-h-screen relative selection:bg-miku selection:text-white font-sans flex flex-col">
            <BackgroundPattern />
        </main>
    );
}
