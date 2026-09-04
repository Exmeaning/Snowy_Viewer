import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/sitemap";

export function buildServerCard(origin: string) {
    return {
        name: "Moesekai - Project SEKAI Data Engine",
        serverInfo: {
            name: "Moesekai MCP",
            version: "1.0.0",
        },
        description: "MCP server for pjsk.moe (Project SEKAI: Colorful Stage! viewer and database). Provides card lookup, music query, event schedules, character profiles, difficulty charts, and gacha data.",
        url: origin,
        transport: {
            type: "http",
            url: `${origin}/api/mcp`,
        },
        capabilities: {
            tools: true,
            resources: true,
            prompts: false,
        },
        tools: [
            {
                name: "search_cards",
                description: "Search Project SEKAI cards by character name or ID, rarity (1 to 4 stars, birthday), attribute (cool, cute, happy, mysterious, pure), or release date.",
            },
            {
                name: "get_card_detail",
                description: "Get comprehensive card details including performance/technique/stamina/total power, skill name, full skill effect, and associated event.",
            },
            {
                name: "search_musics",
                description: "Search Project SEKAI songs by title, lyricist, composer, arranger, or unit.",
            },
            {
                name: "get_music_detail",
                description: "Get song details including difficulty levels (Easy, Normal, Hard, Expert, Master, Append), note counts, and vocal versions.",
            },
            {
                name: "get_event_info",
                description: "Get Project SEKAI event details, type (Marathon, Cheer, Carnival), start/end dates, bonus characters, and bonus attribute.",
            },
            {
                name: "get_character_profile",
                description: "Get character profile, unit affiliation, birthday, height, voice actor/actress (CV), and representative songs.",
            },
            {
                name: "get_realtime_ranking",
                description: "Get real-time ranking leaderboards and tier cutoffs (T50 to T100000) for ongoing Project SEKAI events across JP, CN, EN, and TW servers.",
            },
            {
                name: "get_event_prediction",
                description: "Get event border cutoff predictions with Bayesian-Kalman model confidence intervals (P10/P50/P90) and current velocity.",
            },
            {
                name: "plan_event_strategy",
                description: "Calculate optimal event grinding strategy: required daily hours, plays, fire stamina, large energy drinks, crystals, and feasibility rating.",
            },
            {
                name: "search_gachas",
                description: "Search Project SEKAI gacha banners, pick-up 4-star cards, schedules, and gacha types (Fes, Limited, Birthday, Permanent).",
            },
        ],
        authentication: {
            type: "none",
            description: "No authentication required for public Project SEKAI game database queries.",
        },
    };
}

export async function GET() {
    const origin = await getBaseUrl();
    const card = buildServerCard(origin);

    return NextResponse.json(card, {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
