import { ServerType } from "@/types/prediction";
import { WorldLinkSnapshotV2 } from "@/types/realtime-ranking-next";

const WL_STORAGE_KEY_PREFIX = "moe_wl_snapshot_v2_";

/**
 * Save a live World Link snapshot to client-side localStorage for historical persistence
 */
export function saveWorldLinkSnapshotToStorage(
    server: ServerType,
    eventId: number,
    snapshot: WorldLinkSnapshotV2
): void {
    if (typeof window === "undefined" || !snapshot || !Array.isArray(snapshot.groups) || snapshot.groups.length === 0) {
        return;
    }
    // Only save if it has actual group scores
    const hasData = snapshot.groups.some(g => Array.isArray(g.entries) && g.entries.some(e => e.score > 0));
    if (!hasData) return;

    try {
        const key = `${WL_STORAGE_KEY_PREFIX}${server}_${eventId}`;
        window.localStorage.setItem(key, JSON.stringify({
            savedAt: Date.now(),
            snapshot,
        }));
    } catch {
        // LocalStorage quota or access denied - ignore
    }
}

/**
 * Load a cached or archived World Link snapshot
 */
export async function fetchWorldLinkArchive(
    server: ServerType,
    eventId: number
): Promise<WorldLinkSnapshotV2 | null> {
    // 1. Try local storage cache first
    if (typeof window !== "undefined") {
        try {
            const key = `${WL_STORAGE_KEY_PREFIX}${server}_${eventId}`;
            const cached = window.localStorage.getItem(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.snapshot && Array.isArray(parsed.snapshot.groups) && parsed.snapshot.groups.length > 0) {
                    return parsed.snapshot;
                }
            }
        } catch {
            // Ignore parse errors
        }
    }

    // 2. Try static archive asset: /data/world-link-archives/{server}/{eventId}.json
    try {
        const res = await fetch(`/data/world-link-archives/${server}/${eventId}.json`, { cache: 'default' });
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.groups) && data.groups.length > 0) {
                return {
                    eventId: data.eventId || eventId,
                    region: data.region || server,
                    startAt: data.startAt || 0,
                    endAt: data.endAt || 0,
                    updatedAt: data.updatedAt || Date.now(),
                    groups: data.groups,
                };
            }
        }
    } catch {
        // Ignore fetch errors
    }

    return null;
}
