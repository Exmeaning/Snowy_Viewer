export const BAIJING_API_BASE = "https://baijing.exmeaning.com/api";
export const BAIJING_IMAGE_BASE = "https://baijing.exmeaning.com/image";

export type BaijingServer = "jp" | "cn";

export interface BaijingCompetition {
    id: number;
    name?: string;
    description?: string;
    submitStartAt?: number;
    reviewStartAt?: number;
    submitEndAt?: number;
    aggregateAt?: number;
    backgroundImageAssetbundleFileName?: string;
    backNumberAccentColorCode?: string;
}

export interface BaijingRankingEntry {
    rank: number;
    key?: string;
    seenCount?: number;
    reviewCount?: number;
    ownerUserId?: number | string;
    ownerUserName?: string;
    title?: string;
    comment?: string;
    thumbnailPath?: string;
    thumbnailUrl?: string;
    tabType?: string;
    submittedAt?: number;
    firstSeenAt?: number;
    lastSeenAt?: number;
}

export interface BaijingRankingSnapshot {
    server: BaijingServer;
    competition: BaijingCompetition;
    pollIntervalSeconds?: number;
    snapshotTtlSeconds?: number;
    lastPolledAt?: number;
    snapshotGeneratedAt?: number;
    totalUniqueEntries?: number;
    top100?: BaijingRankingEntry[];
}

export interface BaijingActiveRankingsResponse {
    rankings?: BaijingRankingSnapshot[];
    server?: BaijingServer;
}

export interface BaijingRoomResponse {
    fetchedAt?: number;
    meta?: {
        competitionId?: number;
        entry?: BaijingRankingEntry;
        rank?: number;
    };
    room?: unknown;
}

export function normalizeBaijingServer(value?: string | null): BaijingServer {
    return value === "cn" ? "cn" : "jp";
}

export function getActiveRankingsUrl(server: BaijingServer) {
    return `${BAIJING_API_BASE}/${server}/active-rankings`;
}

export function getRoomUrl(server: BaijingServer, competitionId: number, rank: number) {
    return `${BAIJING_API_BASE}/${server}/housing-competition/${competitionId}/ranking/${rank}/room`;
}

export function getUserMysekaiRoomUrl(server: BaijingServer, userId: string | number) {
    return `${BAIJING_API_BASE}/${server}/user/mysekai/${encodeURIComponent(String(userId))}/room`;
}

export function getEntryThumbnailUrl(server: BaijingServer, entry?: Pick<BaijingRankingEntry, "thumbnailPath" | "thumbnailUrl"> | null) {
    if (!entry) return "";
    if (entry.thumbnailUrl) return entry.thumbnailUrl;
    if (!entry.thumbnailPath) return "";
    return `${BAIJING_IMAGE_BASE}/${server}/mysekai-housing/${entry.thumbnailPath.replace(/^\/+/, "")}`;
}

export function formatDateTime(timestamp?: number) {
    if (!timestamp) return "未提供";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "未提供";
    return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

export function formatFullDateTime(timestamp?: number) {
    if (!timestamp) return "未提供";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "未提供";
    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

export function formatNumber(value?: number) {
    if (!Number.isFinite(Number(value))) return "-";
    return new Intl.NumberFormat("zh-CN").format(Number(value));
}

export function getTabTypeLabel(tabType?: string) {
    switch (tabType) {
        case "popular":
            return "人气";
        case "trend":
            return "趋势";
        case "recommend":
            return "推荐";
        default:
            return tabType || "TOP";
    }
}

export function getRankTone(rank: number) {
    if (rank === 1) return "bg-gradient-to-br from-amber-300 via-yellow-200 to-orange-300 text-amber-950 shadow-amber-300/30";
    if (rank === 2) return "bg-gradient-to-br from-slate-200 via-white to-slate-300 text-slate-700 shadow-slate-300/30";
    if (rank === 3) return "bg-gradient-to-br from-orange-300 via-amber-200 to-yellow-100 text-orange-950 shadow-orange-300/30";
    return "border border-miku/20 bg-miku/10 text-miku shadow-miku/10";
}
