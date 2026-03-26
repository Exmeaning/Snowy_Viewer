// API utilities for event prediction data
// Data source: rk.exmeaning.com

import {
    PredictionData,
    EventListItem,
    ServerType,
    RkEventItem,
    RkLatestResponse,
    RkKlineResponse,
    RkTimelineResponse,
    KLinePoint,
    TierKLine,
} from '@/types/prediction';

const BASE_URL = 'https://rk.exmeaning.com';

export async function fetchEventList(server: ServerType): Promise<EventListItem[]> {
    const response = await fetch(`${BASE_URL}/public/events?region=${server}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch event list: ${response.status}`);
    }
    const data: RkEventItem[] = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map(e => ({
        id: e.event_id,
        name: e.name,
        start_at: e.start_at,
        end_at: e.end_at,
        is_active: e.status === 'active',
        has_data: e.has_realtime_data,
    }));
}

export async function fetchPredictionData(eventId: number, server: ServerType): Promise<PredictionData> {
    const region = `region=${server}`;
    const base = `${BASE_URL}/public/event/${eventId}`;

    // Fetch latest + timeline + kline in parallel
    const [latestRes, timelineRes, klineRes] = await Promise.all([
        fetch(`${base}/latest?${region}`),
        fetch(`${base}/timeline?${region}`),
        fetch(`${base}/kline?${region}`),
    ]);

    if (!latestRes.ok) throw new Error(`Failed to fetch latest: ${latestRes.status}`);
    if (!timelineRes.ok) throw new Error(`Failed to fetch timeline: ${timelineRes.status}`);

    const latest: RkLatestResponse = await latestRes.json();
    const timeline: RkTimelineResponse = await timelineRes.json();
    const klineData: RkKlineResponse | null = klineRes.ok ? await klineRes.json() : null;

    const isActive = latest.status === 'active';
    const updatedAt = new Date(latest.updated_at).getTime();

    // ── Map global kline ────────────────────────────────────────────────────
    const global_kline: KLinePoint[] = (klineData?.klines ?? []).map(k => ({
        t: k.time_bucket,
        o: k.open,
        c: k.close,
        l: k.low,
        h: k.high,
        v: k.volume,
    }));

    // ── Build per-rank history from timeline ────────────────────────────────
    // Group timeline items by rank
    const historyByRank = new Map<number, { t: string; score: number; prediction: number | null }[]>();

    (timeline.timeline ?? []).forEach(entry => {
        entry.items.forEach(item => {
            if (!historyByRank.has(item.rank)) historyByRank.set(item.rank, []);
            historyByRank.get(item.rank)!.push({
                t: entry.collect_time,
                score: item.score,
                prediction: item.prediction,
            });
        });
    });

    // ── Build charts from latest + history ──────────────────────────────────
    const charts = latest.items.map(item => {
        const rankHistory = historyByRank.get(item.rank) ?? [];

        const HistoryPoints = rankHistory.map(h => ({ t: h.t, y: h.score }));
        // Only include predict points that have a non-null prediction value
        const PredictPoints = rankHistory
            .filter(h => h.prediction != null)
            .map(h => ({ t: h.t, y: h.prediction! }));

        return {
            Rank: item.rank,
            CurrentScore: item.score,
            PredictedScore: item.prediction ?? 0,
            HistoryPoints,
            PredictPoints,
        };
    });

    // ── Compute tier_klines from API tier_speeds ────────────────────────────
    const tier_klines: TierKLine[] = [];
    if (isActive && klineData?.tier_speeds) {
        const tlEntries = timeline.timeline ?? [];
        const prevFrame = tlEntries[tlEntries.length - 2];

        klineData.tier_speeds.forEach(ts => {
            let changePct = 0;
            
            // Try to compute ChangePct if we have previous frame data
            if (prevFrame) {
                const item = latest.items.find(i => i.rank === ts.rank);
                const prevItem = prevFrame.items.find(i => i.rank === ts.rank);
                if (item && prevItem && prevItem.score > 0) {
                    changePct = ((item.score - prevItem.score) / prevItem.score) * 100;
                }
            }

            tier_klines.push({
                Rank: ts.rank,
                Data: [], // We don't have per-tier kline data, keep empty
                CurrentIndex: ts.index_value,
                Speed: ts.speed_ph,
                ChangePct: changePct,
            });
        });
    } else if (isActive) {
        // Fallback to manual computation if tier_speeds is missing
        const tlEntries = timeline.timeline ?? [];
        const lastFrame = tlEntries[tlEntries.length - 1];
        const prevFrame = tlEntries[tlEntries.length - 2];

        if (lastFrame) {
            lastFrame.items.forEach(item => {
                const prevItem = prevFrame?.items.find(p => p.rank === item.rank);
                let speed = 0;
                let changePct = 0;
                if (prevItem) {
                    const dtMs = new Date(lastFrame.collect_time).getTime() - new Date(prevFrame!.collect_time).getTime();
                    const dtHours = dtMs / 3600000;
                    const scoreDelta = item.score - prevItem.score;
                    speed = dtHours > 0 ? Math.round(scoreDelta / dtHours) : 0;
                    if (prevItem.score > 0) {
                        changePct = ((item.score - prevItem.score) / prevItem.score) * 100;
                    }
                }
                tier_klines.push({
                    Rank: item.rank,
                    Data: [],
                    CurrentIndex: item.score, // Fallback uses raw score as index
                    Speed: speed,
                    ChangePct: changePct,
                });
            });
        }
    }

    return {
        success: true,
        timestamp: updatedAt,
        data: {
            event_id: eventId,
            event_name: '',
            charts,
            global_kline,
            tier_klines,
        },
    };
}
