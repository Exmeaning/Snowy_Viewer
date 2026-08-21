"use client";
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useI18n } from '@/contexts/I18nContext';
import { KLinePoint } from '@/types/prediction';

interface PGAIChartProps {
    globalKline: KLinePoint[];
    height?: number;
}

interface TooltipParam {
    dataIndex: number;
}

export default function PGAIChart({ globalKline, height: _height = 300 }: PGAIChartProps) {
    const { t, formatNumber } = useI18n();
    const latestPoint = globalKline[globalKline.length - 1];
    const prevPoint = globalKline[globalKline.length - 2];

    const currentIndex = latestPoint?.c || 0;
    // Calculate change % based on previous close, or open if no previous data
    const prevClose = prevPoint?.c || latestPoint?.o || 1;
    const changePct = ((currentIndex - prevClose) / prevClose) * 100;

    const option = useMemo(() => {
        if (!globalKline || globalKline.length === 0) {
            return { title: { text: t("page.prediction.pgai.noKlineData"), left: 'center', top: 'center' } };
        }

        const times = globalKline.map(p => {
            const d = new Date(p.t);
            return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
        });

        // Candlestick data: [open, close, lowest, highest]
        const ohlc = globalKline.map(p => [p.o, p.c, p.l, p.h]);

        // Calculate start percentage for last 48 points (assuming hourly data)
        // If fewer than 48 points, show all (start = 0)
        const totalPoints = globalKline.length;
        const pointsToShow = 48;
        const startPct = totalPoints > pointsToShow ? ((totalPoints - pointsToShow) / totalPoints) * 100 : 0;

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                textStyle: { color: '#334155' },
                formatter: (params: TooltipParam[]) => {
                    const idx = params[0].dataIndex;
                    const item = globalKline[idx];
                    // Colors are inline hex rather than slate-* utilities on purpose:
                    // the tooltip plate above is a hardcoded white, while globals.css
                    // remaps .text-slate-* under [data-theme="dark"] — so a utility
                    // here would turn light-on-white and become unreadable.
                    return `
             <div style="font-weight:700;color:#334155;margin-bottom:0.25rem">${times[idx]}</div>
             <div style="font-size:0.75rem;color:#64748b">
               ${t("page.prediction.pgai.tooltipOpen")}: ${formatNumber(item.o)} <br/>
               ${t("page.prediction.pgai.tooltipClose")}: ${formatNumber(item.c)} <br/>
               ${t("page.prediction.pgai.tooltipHigh")}: ${formatNumber(item.h)} <br/>
               ${t("page.prediction.pgai.tooltipLow")}: ${formatNumber(item.l)}
             </div>
           `;
                }
            },
            legend: { show: false }, // Remove legend as requested
            grid: [
                { left: '10%', right: '8%', top: '15%', height: '50%' },
                { left: '10%', right: '8%', top: '72%', height: '18%' }
            ],
            xAxis: [
                {
                    type: 'category',
                    data: times,
                    boundaryGap: true,
                    axisLine: { lineStyle: { color: '#e2e8f0' } },
                    axisLabel: { color: '#94a3b8', rotate: 45, fontSize: 9 },
                    axisTick: { show: false },
                    splitLine: { show: false }
                },
                {
                    type: 'category',
                    gridIndex: 1,
                    data: times,
                    boundaryGap: true,
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: { show: false },
                    splitLine: { show: false }
                }
            ],
            yAxis: [
                {
                    scale: true,
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
                    axisLabel: { color: '#94a3b8' }
                },
                {
                    scale: true,
                    gridIndex: 1,
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: { show: false },
                    axisLabel: {
                        show: false // Hide volume labels for cleaner look
                    }
                }
            ],
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: [0, 1],
                    start: startPct,
                    end: 100
                },
                {
                    type: 'slider',
                    xAxisIndex: [0, 1],
                    start: startPct,
                    end: 100,
                    height: 15,
                    bottom: 5,
                    borderColor: '#e2e8f0',
                    backgroundColor: '#f8fafc',
                    fillerColor: 'rgba(51, 204, 187, 0.1)',
                }
            ],
            series: [
                {
                    type: 'candlestick',
                    data: ohlc,
                    itemStyle: {
                        color: '#ef4444',     // Rising (Close > Open) -> Red in China/Japan usually? Or Green? 
                        // In standard financial charts: 
                        // China/Japan: Red = Up, Green = Down.
                        // Western: Green = Up, Red = Down.
                        // Let's stick to standard/user preference. Project seems Chinese/Japanese context.
                        // Web default ECharts is Red=Up 
                        color0: '#22c55e', // Falling -> Green
                        borderColor: '#ef4444',
                        borderColor0: '#22c55e'
                    },
                    barWidth: '60%'
                }
            ]
        };
    }, [formatNumber, globalKline, t]);

    return (
        <div className="hh-tile p-6 h-full flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="hh-title text-xl font-black text-[var(--hh-text-primary)] flex items-center gap-2">
                        {t("page.prediction.pgai.title")}
                        <span className="bg-red-500/12 text-red-500 text-[10px] px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] font-bold uppercase">beta</span>
                    </h3>
                    <p className="hh-body text-xs text-[var(--hh-text-tertiary)] mt-1">{t("page.prediction.pgai.subtitle")}</p>
                </div>
                <div className="text-right">
                    <div className={`hh-numeric hh-display text-4xl font-black ${changePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {formatNumber(currentIndex)}
                    </div>
                    <div className={`hh-numeric text-sm font-bold flex items-center justify-end gap-1 ${changePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        <span>{changePct >= 0 ? '▲' : '▼'}</span>
                        {Math.abs(changePct).toFixed(2)}%
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ReactECharts
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                />
            </div>
        </div>
    );
}
