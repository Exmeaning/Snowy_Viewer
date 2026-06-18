"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChurnV2, fetchWorldLinkChurnV2 } from "@/lib/realtime-ranking-next-api";
import { ChurnEntryV2, RealtimeRankingRegion } from "@/types/realtime-ranking-next";
import { entryKey } from "../_lib/board-utils";
import { shouldKeepPreviousChurn } from "@/lib/realtime-ranking-resilience";
import { useRealtimeRankingLine } from "@/lib/realtime-ranking-line";

const CHURN_POLL_INTERVAL = 15_000;
const CHURN_RETRY_DELAYS = [8_000, 20_000, 45_000, 60_000] as const;
const CHURN_TOP = 200;

/**
 * Polls the churn endpoint and exposes a Map keyed by entryKey
 * (userId for players, `tier:{rank}` for tier lines).
 *
 * When `worldLinkCharacterId` is set, it pulls the WL chapter churn instead of
 * the overall churn, so WL-only players (not in the overall board) still get
 * churn data. Pass `null` for the overall board.
 */
export function useChurnData(
    region: RealtimeRankingRegion,
    worldLinkCharacterId: number | null,
    enabled: boolean,
) {
    const line = useRealtimeRankingLine();
    const [churnData, setChurnData] = useState<Map<string, ChurnEntryV2>>(new Map());
    const requestIdRef = useRef(0);
    const retryTimerRef = useRef<number | null>(null);
    const pollTimerRef = useRef<number | null>(null);
    const churnSizeRef = useRef(0);

    const load = useCallback(async (
        nextRegion: RealtimeRankingRegion,
        nextCharId: number | null,
        reset: boolean,
    ): Promise<boolean> => {
        const id = ++requestIdRef.current;
        if (reset) {
            setChurnData(new Map());
            churnSizeRef.current = 0;
        }
        try {
            const rankings = nextCharId != null
                ? await fetchWorldLinkChurnV2(nextRegion, { gameCharacterId: nextCharId, top: CHURN_TOP })
                : await fetchChurnV2(nextRegion, { top: CHURN_TOP });
            if (id !== requestIdRef.current) return true;

            const map = new Map<string, ChurnEntryV2>();
            for (const entry of rankings) {
                const isTierLine = entry.userId == null;
                const key = entryKey(entry.rank, String(entry.userId ?? ""), isTierLine);
                map.set(key, { ...entry, isTierLine: isTierLine || undefined });
            }

            // Resilience: a transiently collapsed churn payload should not wipe
            // the detailed per-row stats that are already displayed.
            if (shouldKeepPreviousChurn(churnSizeRef.current, map.size)) {
                return true;
            }

            setChurnData(map);
            churnSizeRef.current = map.size;
            return true;
        } catch {
            if (id !== requestIdRef.current) return true;
            return false;
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        let disposed = false;

        const clearTimers = () => {
            if (retryTimerRef.current != null) {
                window.clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
            if (pollTimerRef.current != null) {
                window.clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
        clearTimers();

        const startPolling = () => {
            if (disposed || pollTimerRef.current != null) return;
            pollTimerRef.current = window.setInterval(
                () => void load(region, worldLinkCharacterId, false),
                CHURN_POLL_INTERVAL,
            );
        };

        const tryLoad = (attempt: number) => {
            if (disposed) return;
            void load(region, worldLinkCharacterId, attempt === 0).then((ok) => {
                if (disposed) return;
                if (ok) {
                    startPolling();
                    return;
                }
                const delay = CHURN_RETRY_DELAYS[Math.min(attempt, CHURN_RETRY_DELAYS.length - 1)];
                retryTimerRef.current = window.setTimeout(() => tryLoad(attempt + 1), delay);
            });
        };

        tryLoad(0);

        return () => {
            disposed = true;
            requestIdRef.current += 1;
            clearTimers();
        };
        // `line` switches the API host, so churn data must be reloaded on change.
    }, [enabled, region, worldLinkCharacterId, load, line]);

    return churnData;
}
