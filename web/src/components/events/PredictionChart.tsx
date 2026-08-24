"use client";
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useI18n } from '@/contexts/I18nContext';
import { RankChart } from '@/types/prediction';

interface PredictionChartProps {
    data: RankChart;
    height?: number;
    className?: string;
}

export default function PredictionChart({ data, height, className }: PredictionChartProps) {
    const { t, formatNumber } = useI18n();
    const showPrediction = data.Rank <= 10000;
    const actualScoreLabel = t("page.prediction.chart.actualScore");
    const predictedScoreLabel = t("page.prediction.chart.predictedScore");

    const option = useMemo(() => {
        const formatTime = (isoString: string) => {
            const date = new Date(isoString);
            return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
        };

        // Combine history and future prediction timestamps chronologically
        const timeMap = new Map<string, { history: number | null; predict: number | null }>();

        data.HistoryPoints.forEach(p => {
            const tKey = formatTime(p.t);
            timeMap.set(tKey, { history: p.y, predict: null });
        });

        // If prediction points exist, merge them
        if (data.PredictPoints && data.PredictPoints.length > 0) {
            if (data.HistoryPoints.length > 0) {
                const lastHistory = data.HistoryPoints[data.HistoryPoints.length - 1];
                const lastKey = formatTime(lastHistory.t);
                const existing = timeMap.get(lastKey) || { history: lastHistory.y, predict: null };
                existing.predict = lastHistory.y;
                timeMap.set(lastKey, existing);
            }

            data.PredictPoints.forEach(p => {
                const tKey = formatTime(p.t);
                const existing = timeMap.get(tKey) || { history: null, predict: null };
                existing.predict = p.y;
                timeMap.set(tKey, existing);
            });
        }

        const allTimes = Array.from(timeMap.keys());
        const historyScores = allTimes.map(t => timeMap.get(t)?.history ?? null);
        const predictScores = allTimes.map(t => timeMap.get(t)?.predict ?? null);

        return {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                textStyle: { color: '#334155' },
                formatter: (params: { seriesName: string; value: number | null; axisValue: string }[]) => {
                    let result = `<div style="font-weight: 600; margin-bottom: 4px;">${params[0]?.axisValue}</div>`;
                    params.forEach(p => {
                        if (p.value == null) return;
                        const color = p.seriesName === actualScoreLabel ? '#33CCBB' : '#f59e0b';
                        result += `<div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
              <span>${p.seriesName}: ${typeof p.value === "number" ? formatNumber(p.value) : '-'}</span>
            </div>`;
                    });
                    return result;
                }
            },
            legend: {
                data: showPrediction ? [actualScoreLabel, predictedScoreLabel] : [actualScoreLabel],
                top: 0,
                textStyle: { color: '#64748b' }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                top: '12%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: allTimes,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: {
                    color: '#94a3b8',
                    rotate: 45,
                    fontSize: 10
                },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
                axisLabel: {
                    color: '#94a3b8',
                    formatter: (value: number) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                        return formatNumber(value);
                    }
                }
            },
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    start: 0,
                    end: 100,
                    height: 20,
                    bottom: 0,
                    borderColor: '#e2e8f0',
                    backgroundColor: '#f8fafc',
                    fillerColor: 'rgba(51, 204, 187, 0.1)',
                    handleStyle: { color: '#33CCBB' }
                }
            ],
            series: [
                {
                    name: actualScoreLabel,
                    type: 'line',
                    data: historyScores,
                    connectNulls: false,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { color: '#33CCBB', width: 2 },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(51, 204, 187, 0.3)' },
                                { offset: 1, color: 'rgba(51, 204, 187, 0)' }
                            ]
                        }
                    }
                },
                ...(showPrediction ? [{
                    name: predictedScoreLabel,
                    type: 'line' as const,
                    data: predictScores,
                    connectNulls: true,
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' as const },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(245, 158, 11, 0.15)' },
                                { offset: 1, color: 'rgba(245, 158, 11, 0)' }
                            ]
                        }
                    }
                }] : [])
            ]
        };
    }, [actualScoreLabel, data, formatNumber, predictedScoreLabel, showPrediction]);

    return (
        <div
            className={`w-full bg-white rounded-xl border border-slate-100 p-4 flex flex-col ${className || ''}`}
            style={height ? { height: `${height}px` } : undefined}
        >
            <div className="flex-none flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-miku">T{data.Rank}</span>
                    <div className="text-sm">
                        <div className="text-slate-500">{t("page.prediction.table.currentScore")}</div>
                        <div className="font-bold text-slate-700">{formatNumber(data.CurrentScore)}</div>
                    </div>
                </div>
                {showPrediction && (
                    <div className="text-right">
                        <div className="text-sm text-slate-500">{t("page.prediction.table.predictedScore")}</div>
                        <div className="text-lg font-bold text-amber-500">
                            {data.PredictedScore > 0 ? formatNumber(data.PredictedScore) : '-'}
                        </div>
                        {data.PredictedScoreP10 != null && data.PredictedScoreP90 != null && (
                            <div className="text-[10px] text-slate-400 font-mono">
                                90% CI: {formatNumber(data.PredictedScoreP10)} ~ {formatNumber(data.PredictedScoreP90)}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-1 min-h-0">
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                    notMerge={true}
                />
            </div>
        </div>
    );
}
