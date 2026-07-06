
export type InformationServer = "jp" | "cn";
export type InformationBrowseType = "internal" | "external" | string;
export type InformationStatus = "upcoming" | "ongoing" | "ended" | "permanent";

export interface InformationItem {
    id: number;
    seq: number;
    displayOrder: number;
    informationType: string;
    informationTag: string;
    browseType: InformationBrowseType;
    platform: string;
    title: string;
    path: string;
    startAt: number;
    endAt?: number | null;
    bannerAssetbundleName?: string | null;
    channels?: string | null;
}

export interface InformationResponse {
    informations?: InformationItem[];
}

export const INFORMATION_API_BASE = "https://baijing.exmeaning.com";
export const JP_INFORMATION_WEB_BASE = "https://production-web.sekai.colorfulpalette.org";
export const JP_INFORMATION_IMAGE_BASE = `${JP_INFORMATION_WEB_BASE}/images/information`;
export const CN_INFORMATION_IMAGE_BASE = "https://lf3-mkcncdn-tos.dailygn.com/obj/lf-game-lf/gdl_app_5236/images/information";

export function getInformationUrl(server: InformationServer) {
    return `${INFORMATION_API_BASE}/${server}/information`;
}

export async function fetchInformationList(server: InformationServer): Promise<InformationItem[]> {
    const response = await fetch(`${getInformationUrl(server)}?_ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = await response.json() as InformationResponse;
    return Array.isArray(data.informations) ? data.informations : [];
}

export function getInformationBannerUrl(server: InformationServer, bannerAssetbundleName?: string | null) {
    if (!bannerAssetbundleName) return "";
    const encodedName = encodeURIComponent(bannerAssetbundleName);
    const base = server === "cn" ? CN_INFORMATION_IMAGE_BASE : JP_INFORMATION_IMAGE_BASE;
    return `${base}/${encodedName}.png`;
}

export function resolveInformationPath(server: InformationServer, item: Pick<InformationItem, "path">) {
    const path = item.path?.trim() ?? "";
    if (!path) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
    if (path.startsWith("//")) return `https:${path}`;

    if (server === "jp") {
        return `${JP_INFORMATION_WEB_BASE}/${path.replace(/^\/+/, "")}`;
    }

    return path.startsWith("/") ? path : `/${path}`;
}

export function getInformationStatus(item: Pick<InformationItem, "startAt" | "endAt">, now = Date.now()): InformationStatus {
    if (Number.isFinite(item.startAt) && item.startAt > now) return "upcoming";
    if (!item.endAt) return "permanent";
    if (item.endAt < now) return "ended";
    return "ongoing";
}

export function getInformationTagTone(tag?: string) {
    switch (tag) {
        case "event":
            return "bg-pink-500 text-white shadow-pink-500/20";
        case "gacha":
            return "bg-purple-500 text-white shadow-purple-500/20";
        case "music":
            return "bg-sky-500 text-white shadow-sky-500/20";
        case "campaign":
            return "bg-amber-500 text-white shadow-amber-500/20";
        case "bug":
            return "bg-red-500 text-white shadow-red-500/20";
        case "update":
            return "bg-emerald-500 text-white shadow-emerald-500/20";
        case "information":
            return "bg-miku text-white shadow-miku/20";
        default:
            return "bg-slate-500 text-white shadow-slate-500/20";
    }
}

export function getInformationStatusTone(status: InformationStatus) {
    switch (status) {
        case "upcoming":
            return "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25";
        case "ongoing":
            return "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25";
        case "ended":
            return "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:ring-slate-700";
        case "permanent":
        default:
            return "bg-miku/10 text-miku ring-miku/20";
    }
}

export function normalizeInformationServer(value?: string | null): InformationServer {
    return value === "cn" ? "cn" : "jp";
}
