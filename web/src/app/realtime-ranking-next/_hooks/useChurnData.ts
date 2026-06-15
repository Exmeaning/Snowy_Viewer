"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChurnV2 } from "@/lib/realtime-ranking-next-api";
import { ChurnEntryV2, RealtimeRankingRegion } from "@/types/realtime-ranking-next";
import { entryKey } from "../_lib/board-utils";

const CHURN_POLL_INTERVAL = 15_000;
const CHURN_RETRY_DELAYS = [8_000, 20_000, 45_000, 60_000] as const;
const CHURN_TOP = 200;

/**
 * Polls the v2 churn endpoint and exposes a Map keyed by entryKey
 * (userId for players, `tier:{rank}` for tier lines).
 */
export function useChurnData(region: RealtimeRankingRegion, enabled: boolean) {
    const [churnData, setChurnData] = useState<Map<string, ChurnEntryV2>>(new Map());
    const requestIdRef = useRef(0);
    const retryTimerRef = useRef<number | null>(null);
    const pollTimerRef = useRef<number | null>(null);

    const load = useCallback(async (nextRegion: RealtimeRankingRegion, reset: boolean): Promise<boolean> => {
        const id = ++requestIdRef.current;
        if (reset) setChurnData(new Map());
        try {
            const rankings = await fetchChurnV2(nextRegion, { top: CHURN_TOP });
            if (id !== requestIdRef.current) return true;

            const map = new Map<string, ChurnEntryV2>();
            for (const entry of rankings) {
                const isTierLine = entry.userId == null;
                const key = entryKey(entry.rank, String(entry.userId ?? ""), isTierLine);
                map.set(key, { ...entry, isTierLine: isTierLine || undefined });
            }
            setChurnData(map);
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
            pollTimerRef.current = window.setInterval(() => void load(region, false), CHURN_POLL_INTERVAL);
        };

        const tryLoad = (attempt: number) => {
            if (disposed) return;
            void load(region, attempt === 0).then((ok) => {
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
    }, [enabled, region, load]);

    return churnData;
}
