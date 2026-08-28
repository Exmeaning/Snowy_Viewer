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
    RankChart,
} from '@/types/prediction';
import { calculateEventPrediction } from '@/lib/prediction-engine';
import {
    dedupeInflight,
    getCachedTimeline,
    setCachedTimeline,
    getCachedKline,
    setCachedKline,
    getCachedEventList,
    setCachedEventList,
    publishRankingSync,
    extractTierScoresFromEntries,
} from '@/lib/ranking-sync';
import { fetchLatestV2, fetchTierSeriesV2 } from '@/lib/realtime-ranking-next-api';
import { fetchMasterDataForServer, fetchMasterData } from '@/lib/fetch';
import { IEventInfo } from '@/types/events';

const BASE_URL = 'https://rk.exmeaning.com';
const TARGET_TIERS = [50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 5000, 10000];

export async function fetchEventList(server: ServerType): Promise<EventListItem[]> {
    const cached = getCachedEventList(server);
    if (cached) return cached;

    return dedupeInflight(`eventList:${server}`, async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const response = await fetch(`${BASE_URL}/public/events?region=${server}`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data: RkEventItem[] = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const list = data.map(e => ({
                        id: e.event_id,
                        name: e.name,
                        start_at: e.start_at,
                        end_at: e.end_at,
                        is_active: e.status === 'active',
                        has_data: e.has_realtime_data,
                        event_type: e.event_type,
                    }));
                    setCachedEventList(server, list);
                    return list;
                }
            }
        } catch (_err) {
            // Fallback gracefully below
        }

        // Fallback: masterdata events.json + active status from realtime ranking v2
        try {
            const masterEvents = await fetchMasterDataForServer<IEventInfo[]>(server, 'events.json')
                .catch(() => fetchMasterData<IEventInfo[]>('events.json'));
            
            let activeEventId: number | null = null;
            try {
                const latest = await fetchLatestV2(server);
                if (latest?.eventId) activeEventId = latest.eventId;
            } catch {
                // Ignore
            }

            const now = Date.now();
            const list: EventListItem[] = masterEvents.map(e => {
                const isOngoing = (now >= e.startAt && now <= e.aggregateAt) || (activeEventId ? e.id === activeEventId : false);
                return {
                    id: e.id,
                    name: e.name,
                    start_at: e.startAt,
                    end_at: e.aggregateAt,
                    is_active: isOngoing,
                    has_data: isOngoing || e.id === activeEventId,
                    event_type: e.eventType,
                };
            });

            setCachedEventList(server, list);
            return list;
        } catch (fallbackErr) {
            console.error('[prediction-api] Fallback event list failed:', fallbackErr);
            return [];
        }
    });
}

export async function fetchPredictionLatest(eventId: number, server: ServerType): Promise<RkLatestResponse> {
    const region = `region=${server}`;
    const url = `${BASE_URL}/public/event/${eventId}/latest?${region}`;

    return dedupeInflight(`latest:${server}:${eventId}`, async () => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch latest: ${response.status}`);
        }
        const latest: RkLatestResponse = await response.json();
        const updatedAt = new Date(latest.updated_at).getTime();

        // Publish live sync update to the global bus
        publishRankingSync({
            region: server,
            eventId,
            updatedAt,
            tierScores: extractTierScoresFromEntries(latest.items),
            source: 'prediction',
        });

        return latest;
    });
}

async function buildPredictionDataFromRealtimeV2(server: ServerType, eventId: number): Promise<PredictionData> {
    const latestSnapshot = await fetchLatestV2(server);
    const updatedAt = latestSnapshot.updatedAt || Date.now();
    const cachedList = getCachedEventList(server);
    const eventMeta = cachedList?.find(e => e.id === eventId);

    let eventStartAt = latestSnapshot.startAt || 0;
    let eventEndAt = latestSnapshot.endAt || 0;

    if (!eventStartAt || !eventEndAt) {
        if (eventMeta?.start_at && eventMeta?.end_at) {
            eventStartAt = eventMeta.start_at < 10000000000 ? eventMeta.start_at * 1000 : eventMeta.start_at;
            eventEndAt = eventMeta.end_at < 10000000000 ? eventMeta.end_at * 1000 : eventMeta.end_at;
        } else {
            eventStartAt = Date.now() - 4 * 24 * 3600000;
            eventEndAt = eventStartAt + 9 * 24 * 3600000;
        }
    }

    const isWorldLinkEvent = eventMeta?.event_type === 'world_bloom'
        || (eventMeta?.name?.includes('WORLD LINK') ?? false)
        || (eventMeta?.name?.includes('ワールドリンク') ?? false)
        || (server === 'jp' && eventId >= 210);
    const eventType = isWorldLinkEvent ? 'world_bloom' : (eventMeta?.event_type || 'marathon');
    const bonusPercent = isWorldLinkEvent ? 990 : 475;

    // Try fetching tier-series if available
    let tierSeriesMap: Record<string, { t: number; s: number }[]> = {};
    try {
        const seriesController = new AbortController();
        const tid = setTimeout(() => seriesController.abort(), 2500);
        tierSeriesMap = await fetchTierSeriesV2(server, { tiers: TARGET_TIERS }).catch(() => ({}));
        clearTimeout(tid);
    } catch {
        tierSeriesMap = {};
    }

    const tierScores = extractTierScoresFromEntries(latestSnapshot.entries);
    publishRankingSync({
        region: server,
        eventId,
        updatedAt,
        tierScores,
        source: 'prediction',
    });

    const charts: RankChart[] = TARGET_TIERS.map(rank => {
        const entry = latestSnapshot.entries.find(e => e.rank === rank);
        const currentScore = entry?.score || 0;

        let historyPoints: { t: string; y: number }[] = [];
        const series = tierSeriesMap[String(rank)];
        if (Array.isArray(series) && series.length > 0) {
            historyPoints = series.map(pt => ({
                t: new Date(pt.t).toISOString(),
                y: pt.s,
            }));
        }

        const startIso = new Date(eventStartAt).toISOString();
        const nowIso = new Date(updatedAt).toISOString();
        if (historyPoints.length === 0) {
            historyPoints = [{ t: startIso, y: 0 }, { t: nowIso, y: currentScore }];
        } else {
            if (new Date(historyPoints[0].t).getTime() > eventStartAt + 3600000) {
                historyPoints.unshift({ t: startIso, y: 0 });
            }
            const lastPt = historyPoints[historyPoints.length - 1];
            if (Math.abs(new Date(lastPt.t).getTime() - updatedAt) < 60000) {
                lastPt.y = currentScore;
            } else {
                historyPoints.push({ t: nowIso, y: currentScore });
            }
        }

        const engineResult = calculateEventPrediction({
            server,
            rank,
            startAt: eventStartAt,
            endAt: eventEndAt,
            historyPoints,
            eventType,
            bonusPercent,
        });

        return {
            Rank: rank,
            CurrentScore: currentScore,
            PredictedScore: engineResult.predictedScore,
            PredictedScoreP10: engineResult.predictedScoreP10,
            PredictedScoreP90: engineResult.predictedScoreP90,
            HistoryPoints: historyPoints,
            PredictPoints: engineResult.predictPoints,
        };
    });

    const elapsedHours = Math.max(0.1, (updatedAt - eventStartAt) / 3600000);
    const tier_klines: TierKLine[] = TARGET_TIERS.map(rank => {
        const chart = charts.find(c => c.Rank === rank);
        const score = chart?.CurrentScore || 0;
        const speed = elapsedHours > 0 ? Math.round(score / elapsedHours) : 0;
        return {
            Rank: rank,
            Data: [],
            CurrentIndex: score,
            Speed: speed,
            ChangePct: 0,
        };
    });

    return {
        success: true,
        timestamp: updatedAt,
        data: {
            event_id: eventId,
            event_name: eventMeta?.name || '',
            charts,
            global_kline: [],
            tier_klines,
        },
    };
}

export async function fetchPredictionData(eventId: number, server: ServerType): Promise<PredictionData> {
    const region = `region=${server}`;
    const base = `${BASE_URL}/public/event/${eventId}`;

    return dedupeInflight(`predictionData:${server}:${eventId}`, async () => {
        try {
            // Check SWR caches for heavy timeline and kline data
            const cachedTimeline = getCachedTimeline(server, eventId);
            const cachedKline = getCachedKline(server, eventId);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const fetchPromises: [Promise<Response>, Promise<Response | null>, Promise<Response | null>] = [
                fetch(`${base}/latest?${region}`, { cache: 'no-store', signal: controller.signal }),
                cachedTimeline ? Promise.resolve(null) : fetch(`${base}/timeline?${region}`, { signal: controller.signal }),
                cachedKline !== undefined ? Promise.resolve(null) : fetch(`${base}/kline?${region}`, { signal: controller.signal }),
            ];

            const [latestRes, timelineRes, klineRes] = await Promise.all(fetchPromises);
            clearTimeout(timeoutId);

            if (latestRes && latestRes.ok) {
                const latest: RkLatestResponse = await latestRes.json();
                let timeline: RkTimelineResponse;
                if (cachedTimeline) {
                    timeline = cachedTimeline;
                } else if (timelineRes && timelineRes.ok) {
                    timeline = await timelineRes.json();
                    setCachedTimeline(server, eventId, timeline);
                } else {
                    timeline = {
                        event_id: eventId,
                        status: latest.status || 'active',
                        granularity: 0,
                        final_only: false,
                        timeline: [],
                    };
                }

                let klineData: RkKlineResponse | null = null;
                if (cachedKline !== undefined) {
                    klineData = cachedKline;
                } else if (klineRes && klineRes.ok) {
                    klineData = await klineRes.json();
                    setCachedKline(server, eventId, klineData);
                }

                const isActive = latest.status === 'active';
                const updatedAt = new Date(latest.updated_at).getTime();

                // Broadcast to shared sync layer
                publishRankingSync({
                    region: server,
                    eventId,
                    updatedAt,
                    tierScores: extractTierScoresFromEntries(latest.items),
                    source: 'prediction',
                });

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

                // Extract start and end times for the prediction engine
                const tlEntries = timeline.timeline ?? [];
                let eventStartAt = 0;
                let eventEndAt = 0;
                const cachedList = getCachedEventList(server);
                const eventMeta = cachedList?.find(e => e.id === eventId);
                if (eventMeta?.start_at && eventMeta?.end_at) {
                    eventStartAt = eventMeta.start_at < 10000000000 ? eventMeta.start_at * 1000 : eventMeta.start_at;
                    eventEndAt = eventMeta.end_at < 10000000000 ? eventMeta.end_at * 1000 : eventMeta.end_at;
                } else if (tlEntries.length > 0) {
                    eventStartAt = new Date(tlEntries[0].collect_time).getTime();
                    // Standard event duration is 9 days (777,600,000 ms)
                    eventEndAt = eventStartAt + (9 * 24 * 3600000);
                }

                const isWorldLinkEvent = eventMeta?.event_type === 'world_bloom'
                    || (eventMeta?.name?.includes('WORLD LINK') ?? false)
                    || (eventMeta?.name?.includes('ワールドリンク') ?? false);
                const eventType = isWorldLinkEvent ? 'world_bloom' : (eventMeta?.event_type || 'marathon');
                const bonusPercent = isWorldLinkEvent ? 990 : 475;

                // ── Build charts from latest + history + high-order prediction engine ───
                const charts = latest.items.map(item => {
                    const rankHistory = historyByRank.get(item.rank) ?? [];
                    const HistoryPoints = rankHistory.map(h => ({ t: h.t, y: h.score }));

                    let predictedScore = item.prediction ?? 0;
                    let predictedScoreP10: number | undefined;
                    let predictedScoreP90: number | undefined;
                    let PredictPoints = rankHistory
                        .filter(h => h.prediction != null)
                        .map(h => ({ t: h.t, y: h.prediction! }));

                    // Run the AkiYome v2.0.0-Tori Bayesian-Kalman engine
                    if (isActive && HistoryPoints.length > 0 && item.rank <= 10000) {
                        const result = calculateEventPrediction({
                            server,
                            rank: item.rank,
                            startAt: eventStartAt,
                            endAt: eventEndAt,
                            historyPoints: HistoryPoints,
                            eventType,
                            bonusPercent,
                        });

                        predictedScore = result.predictedScore;
                        predictedScoreP10 = result.predictedScoreP10;
                        predictedScoreP90 = result.predictedScoreP90;
                        PredictPoints = result.predictPoints;
                    }

                    return {
                        Rank: item.rank,
                        CurrentScore: item.score,
                        PredictedScore: predictedScore,
                        PredictedScoreP10: predictedScoreP10,
                        PredictedScoreP90: predictedScoreP90,
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
                        
                        if (prevFrame) {
                            const item = latest.items.find(i => i.rank === ts.rank);
                            const prevItem = prevFrame.items.find(i => i.rank === ts.rank);
                            if (item && prevItem && prevItem.score > 0) {
                                changePct = ((item.score - prevItem.score) / prevItem.score) * 100;
                            }
                        }

                        tier_klines.push({
                            Rank: ts.rank,
                            Data: [],
                            CurrentIndex: ts.index_value,
                            Speed: ts.speed_ph,
                            ChangePct: changePct,
                        });
                    });
                } else if (isActive) {
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
                                CurrentIndex: item.score,
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
        } catch (err) {
            console.warn('[prediction-api] Primary endpoint failed, falling back to realtime ranking snapshot:', err);
        }

        // Fallback to Realtime Ranking V2 snapshot
        return buildPredictionDataFromRealtimeV2(server, eventId);
    });
}
