import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VALID_DIFFICULTIES = new Set(["easy", "normal", "hard", "expert", "master", "append"]);
const UPSTREAM_CHART_BASE = "https://charts-new.unipjsk.com/moe/svg";
const ABSOLUTE_NOTES_BASE = "https://charts-new.unipjsk.com/moe/notes_new/";

/**
 * Normalizes chart SVG to fix upstream asset reference and SVG spec issues:
 * 1. Rewrites relative note sprite paths (e.g. `../../notes_new/`) to absolute CDN URLs
 *    at `https://charts-new.unipjsk.com/moe/notes_new/`.
 * 2. Normalizes negative width/height attributes in clipPath rects which violate the SVG spec.
 */
export function normalizeChartSvg(rawSvg: string): string {
    let svg = rawSvg;

    // Fix relative notes_new paths
    svg = svg.replaceAll("../../notes_new/", ABSOLUTE_NOTES_BASE);
    svg = svg.replaceAll("../notes_new/", ABSOLUTE_NOTES_BASE);
    svg = svg.replaceAll('href="/notes_new/', `href="${ABSOLUTE_NOTES_BASE}`);
    svg = svg.replaceAll('xlink:href="/notes_new/', `xlink:href="${ABSOLUTE_NOTES_BASE}`);

    // Fix invalid negative width or height values in rect elements (e.g. width="-3.1428571428571423")
    svg = svg.replace(/\bwidth="-\d+(?:\.\d+)?"/g, 'width="0"');
    svg = svg.replace(/\bheight="-\d+(?:\.\d+)?"/g, 'height="0"');

    return svg;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ musicId: string; difficulty: string }> }
) {
    const { musicId: rawMusicId, difficulty: rawDifficulty } = await context.params;

    // Handle optional trailing .svg in difficulty param (e.g. master.svg -> master)
    const difficultyClean = rawDifficulty.replace(/\.svg$/i, "").toLowerCase();
    const musicIdNum = parseInt(rawMusicId, 10);

    if (isNaN(musicIdNum) || musicIdNum <= 0 || !VALID_DIFFICULTIES.has(difficultyClean)) {
        return new Response("Invalid music ID or difficulty", { status: 400 });
    }

    const upstreamUrl = `${UPSTREAM_CHART_BASE}/${musicIdNum}/${difficultyClean}.svg`;

    try {
        const upstreamRes = await fetch(upstreamUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Moesekai Chart Proxy)",
                Accept: "image/svg+xml,*/*",
            },
            next: { revalidate: 86400 },
        });

        if (!upstreamRes.ok) {
            return new Response(`Upstream error: ${upstreamRes.statusText}`, {
                status: upstreamRes.status,
                headers: {
                    "Cache-Control": "no-store",
                },
            });
        }

        const rawSvg = await upstreamRes.text();
        const fixedSvg = normalizeChartSvg(rawSvg);

        return new Response(fixedSvg, {
            status: 200,
            headers: {
                "Content-Type": "image/svg+xml; charset=utf-8",
                "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            },
        });
    } catch (error) {
        return new Response(`Failed to fetch chart: ${error instanceof Error ? error.message : "Unknown error"}`, {
            status: 502,
            headers: {
                "Cache-Control": "no-store",
            },
        });
    }
}
