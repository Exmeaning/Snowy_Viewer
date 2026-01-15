// Virtual Live Types for Snowy Viewer
// Based on sekai.best and Haruki master data structure

export type VirtualLiveType =
    | "normal"
    | "beginner"
    | "archive"
    | "cheerful_carnival"
    | "connect_live"
    | "streaming";

export interface IVirtualLiveSchedule {
    id: number;
    virtualLiveId: number;
    seq: number;
    startAt: number;
    endAt: number;
    isAfterEvent?: boolean;
}

export interface IVirtualLiveSetlist {
    id: number;
    virtualLiveId: number;
    seq: number;
    virtualLiveSetlistType: "mc" | "music";
    assetbundleName: string;
    virtualLiveStageId: number;
    musicId?: number;
    musicVocalId?: number;
    character3dId1?: number;
    character3dId2?: number;
    character3dId3?: number;
    character3dId4?: number;
    character3dId5?: number;
}

export interface IVirtualLiveInfo {
    id: number;
    virtualLiveType: VirtualLiveType;
    virtualLivePlatform: string;
    seq: number;
    name: string;
    assetbundleName: string;
    screenMvMusicVocalId?: number;
    startAt: number;
    endAt: number;
    rankingAnnounceAt?: number;
    virtualLiveSetlists?: IVirtualLiveSetlist[];
    virtualLiveBeginnerSchedules?: IVirtualLiveSchedule[];
    virtualLiveSchedules?: IVirtualLiveSchedule[];
}

// Virtual live type display names
export const VIRTUAL_LIVE_TYPE_NAMES: Record<VirtualLiveType, string> = {
    normal: "普通",
    beginner: "新手",
    archive: "归档",
    cheerful_carnival: "欢乐嘉年华",
    connect_live: "联动Live",
    streaming: "串流",
};

// Virtual live type colors
export const VIRTUAL_LIVE_TYPE_COLORS: Record<VirtualLiveType, string> = {
    normal: "#42A5F5",
    beginner: "#66BB6A",
    archive: "#9E9E9E",
    cheerful_carnival: "#FFB74D",
    connect_live: "#AB47BC",
    streaming: "#26C6DA",
};

/**
 * Get virtual live status based on current time
 */
export type VirtualLiveStatus = "upcoming" | "ongoing" | "ended";

export function getVirtualLiveStatus(virtualLive: IVirtualLiveInfo): VirtualLiveStatus {
    const now = Date.now();
    if (now < virtualLive.startAt) return "upcoming";
    if (now > virtualLive.endAt) return "ended";
    return "ongoing";
}

/**
 * Get virtual live status display info
 */
export const VIRTUAL_LIVE_STATUS_DISPLAY: Record<VirtualLiveStatus, { label: string; color: string }> = {
    upcoming: { label: "即将开始", color: "#42A5F5" },
    ongoing: { label: "进行中", color: "#66BB6A" },
    ended: { label: "已结束", color: "#9E9E9E" },
};
