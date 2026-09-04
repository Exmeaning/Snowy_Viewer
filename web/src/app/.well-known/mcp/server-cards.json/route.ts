import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/sitemap";
import { buildServerCard } from "../../mcp.json/route";

export async function GET() {
    const origin = await getBaseUrl();
    const card = buildServerCard(origin);

    return NextResponse.json([card], {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
