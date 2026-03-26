"use client";

import Modal from "@/components/common/Modal";
import { ChurnRankingEntry } from "@/types/realtime-ranking";

interface ParkingPeriodsModalProps {
    userId: string | null;
    churnEntry?: ChurnRankingEntry;
    onClose: () => void;
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
}

function formatDuration(startMs: number, endMs?: number, durationS?: number): string {
    // 优先使用 API 返回的 duration_s
    const totalSeconds = durationS != null ? durationS : Math.max(0, Math.floor(((endMs ?? Date.now()) - startMs) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

export default function ParkingPeriodsModal({ userId, churnEntry, onClose }: ParkingPeriodsModalProps) {
    const playerName = churnEntry?.name ?? `玩家 ${userId}`;
    const periods = churnEntry?.parking_periods ?? [];

    return (
        <Modal
            isOpen={!!userId}
            onClose={onClose}
            title={`${playerName} 的停车区间`}
            size="md"
        >
            {periods.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                    <div className="mb-2 text-2xl">🅿️</div>
                    <p className="text-sm font-medium">该玩家暂无停车记录</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {periods.map((period, index) => {
                        const isOngoing = !period.end_time;
                        return (
                            <div
                                key={index}
                                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                                    isOngoing
                                        ? "border-miku/30 bg-miku/5"
                                        : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                                }`}
                            >
                                {/* 序号 */}
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                                    isOngoing
                                        ? "bg-miku text-white"
                                        : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                                }`}>
                                    {index + 1}
                                </div>

                                {/* 时间信息 */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="font-medium text-slate-600 dark:text-slate-300">
                                            {formatTime(period.start_time)}
                                        </span>
                                        <span className="text-slate-400">→</span>
                                        <span className={`font-medium ${isOngoing ? "text-miku" : "text-slate-600 dark:text-slate-300"}`}>
                                            {isOngoing ? "进行中" : formatTime(period.end_time!)}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                                        持续 {formatDuration(period.start_time, period.end_time, period.duration_s)}
                                    </div>
                                </div>

                                {/* 状态标签 */}
                                {isOngoing && (
                                    <span className="shrink-0 rounded-full bg-miku/10 px-2 py-0.5 text-[10px] font-bold text-miku">
                                        停车中
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
