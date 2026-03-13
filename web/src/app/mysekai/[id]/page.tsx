import { Metadata } from "next";
import { Suspense } from "react";
import { getFixtureMeta } from "@/lib/metadata";
import MysekaiFixtureDetailClient from "./client";

const OG_ASSET = "https://snowyassets.exmeaning.com";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const fixture = getFixtureMeta(Number(id));
    if (!fixture) return { title: "家具详情" };

    const title = fixture.name;
    const description = fixture.flavor
        ? `Project Sekai 家具「${fixture.name}」- ${fixture.flavor.slice(0, 100)}`
        : `Project Sekai 家具「${fixture.name}」`;
    const ogImage = `${OG_ASSET}/ondemand/mysekai/thumbnail/fixture/${fixture.asset}_1.png`;

    return {
        title,
        description,
        openGraph: { title, description, images: [ogImage] },
        twitter: { card: "summary", title, description, images: [ogImage] },
    };
}

export default function MysekaiFixtureDetailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="loading-spinner"></div></div>}>
            <MysekaiFixtureDetailClient />
        </Suspense>
    );
}
