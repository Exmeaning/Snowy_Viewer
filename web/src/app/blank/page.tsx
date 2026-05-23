import React from "react";
import BackgroundPattern from "@/components/BackgroundPattern";
import { noIndexPageMetadata } from "@/lib/seo-metadata";

export const generateMetadata = noIndexPageMetadata("blank");

export default function BlankPage() {
    return (
        <main className="min-h-screen relative selection:bg-miku selection:text-white font-sans flex flex-col">
            <BackgroundPattern />
        </main>
    );
}
