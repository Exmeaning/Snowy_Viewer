// TypeScript types for event prediction data

// ─── Internal display types (used by components) ─────────────────────────────

export interface TimePoint {
    t: string;  // ISO timestamp
    y: number;  // score value
}

export interface RankChart {
    Rank: number;
    CurrentScore: number;
    PredictedScore: number;
    HistoryPoints: TimePoint[];
    PredictPoints: TimePoint[];
}

// PGAI K线数据 (全服积极指数)
export interface KLinePoint {
    t: string;  // ISO timestamp
    o: number;  // 开盘
    c: number;  // 收盘
    l: number;  // 最低
    h: number;  // 最高
    v: number;  // 成交量
}

export interface TierKLine {
    Rank: number;
    Data: KLinePoint[];
    CurrentIndex: number;
    Speed: number;
    ChangePct: number;
}

export interface PredictionData {
    success: boolean;
    timestamp: number;
    data: {
        event_id: number;
        event_name: string;
        charts: RankChart[];
        global_kline: KLinePoint[];  // PGAI 全服K线
        tier_klines: TierKLine[];    // 各榜线K线
    };
}

export interface EventListItem {
    id: number;
    name: string;
    start_at?: number;
    end_at?: number;
    is_active?: boolean;
    has_data?: boolean;
}

export type ServerType = 'cn' | 'jp';

// ─── Raw API types from rk.exmeaning.com ─────────────────────────────────────

export interface RkEventItem {
    event_id: number;
    name: string;
    event_type: string;
    start_at: number;
    end_at: number;
    status: 'active' | 'finished' | string;
    has_finalized_data: boolean;
    has_realtime_data: boolean;
}

export interface RkLatestItem {
    rank: number;
    score: number;
    prediction: number | null;
    user_name: string;
    user_id: string;
    collect_time: string;
    is_final: boolean;
}

export interface RkLatestResponse {
    event_id: number;
    status: string;
    updated_at: string;
    items: RkLatestItem[];
}

export interface RkKlinePoint {
    time_bucket: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface RkTierSpeed {
    rank: number;
    speed_ph: number;
    index_value: number;
}

export interface RkKlineResponse {
    event_id: number;
    status: string;
    klines: RkKlinePoint[];
    tier_speeds?: RkTierSpeed[];
}

export interface RkTimelineEntry {
    progress: number;
    collect_time: string;
    items: RkLatestItem[];
}

export interface RkTimelineResponse {
    event_id: number;
    status: string;
    granularity: number;
    final_only: boolean;
    timeline?: RkTimelineEntry[];
}
