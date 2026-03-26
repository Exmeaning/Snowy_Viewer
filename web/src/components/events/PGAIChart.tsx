"use client";
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { KLinePoint } from '@/types/prediction';

interface PGAIChartProps {
    globalKline: KLinePoint[];
    height?: number;
}

interface TooltipParam {
    dataIndex: number;
}

export default function PGAIChart({ globalKline, height = 300 }: PGAIChartProps) {
    const latestPoint = globalKline[globalKline.length - 1];
    const prevPoint = globalKline[globalKline.length - 2];

    const currentIndex = latestPoint?.c || 0;
    // Calculate change % based on previous close, or open if no previous data
    const prevClose = prevPoint?.c || latestPoint?.o || 1;
    const changePct = ((currentIndex - prevClose) / prevClose) * 100;

    const option = useMemo(() => {
        if (!globalKline || globalKline.length === 0) {
            return { title: { text: '暂无K线数据', left: 'center', top: 'center' } };
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
                    return `
             <div class="font-bold text-slate-700 mb-1">${times[idx]}</div>
             <div class="text-xs text-slate-500">
               开: ${item.o} <br/>
               收: ${item.c} <br/>
               高: ${item.h} <br/>
               低: ${item.l}
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
    }, [globalKline]);

    return (
        <div className="bg-white rounded-xl border border-slate-100 p-6 h-full flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        PJSK 全服实时积极指数 (PGAI)
                        <span className="bg-red-50 text-red-500 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">beta</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Based on hourly volatility</p>
                </div>
                <div className="text-right">
                    <div className={`text-4xl font-black ${changePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {currentIndex.toLocaleString()}
                    </div>
                    <div className={`text-sm font-bold flex items-center justify-end gap-1 ${changePct >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
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
