import { NextRequest, NextResponse } from "next/server";

/**
 * 音频代理 API - 解决 Web Audio API 加载跨域音频的 CORS 问题
 * 用法: /api/audio-proxy?url=https://example.com/audio.mp3
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const allowedHosts = [
        "snowyassets.exmeaning.com",
        "assets.exmeaning.com",
        "assets.unipjsk.com",
        "sekai-assets-bdf29c81.seiunx.net",
        "storage.sekai.best",
    ];

    try {
        const parsedUrl = new URL(url);
        if (!allowedHosts.includes(parsedUrl.hostname)) {
            return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    try {
        const res = await fetch(url);
        if (!res.ok) {
            return NextResponse.json({ error: "Upstream error" }, { status: res.status });
        }

        const contentType = res.headers.get("content-type") || "audio/mpeg";
        const buffer = await res.arrayBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch {
        return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    }
}
