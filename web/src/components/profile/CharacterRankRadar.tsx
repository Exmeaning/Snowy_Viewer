"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { CHAR_NAMES, UNIT_NAME_MAP } from "@/types/types";
import { useTheme } from "@/contexts/ThemeContext";

type UnitKey = "overview" | "ln" | "mmj" | "vbs" | "wxs" | "n25" | "vs";

interface Props {
    characterRanks: Map<number, number>;
}

const UNIT_CONFIG: Record<UnitKey, { label: string; color: string; icon?: string; ids: number[] }> = {
    overview: { label: "总览", color: "#7b7b7b", ids: [21, 22, 23, 24, 25, 26, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
    ln: { label: UNIT_NAME_MAP.light_sound, color: "#4455DD", icon: "/data/icon/ln.webp", ids: [1, 2, 3, 4] },
    mmj: { label: UNIT_NAME_MAP.idol, color: "#88DD44", icon: "/data/icon/mmj.webp", ids: [5, 6, 7, 8] },
    vbs: { label: UNIT_NAME_MAP.street, color: "#EE1166", icon: "/data/icon/vbs.webp", ids: [9, 10, 11, 12] },
    wxs: { label: UNIT_NAME_MAP.theme_park, color: "#FF9900", icon: "/data/icon/wxs.webp", ids: [13, 14, 15, 16] },
    n25: { label: UNIT_NAME_MAP.school_refusal, color: "#884499", icon: "/data/icon/n25.webp", ids: [17, 18, 19, 20] },
    vs: { label: UNIT_NAME_MAP.piapro, color: "#33CCBB", icon: "/data/icon/vs.webp", ids: [21, 22, 23, 24, 25, 26] },
};

const unitColor = (id: number) => id >= 21 ? UNIT_CONFIG.vs.color : id <= 4 ? UNIT_CONFIG.ln.color : id <= 8 ? UNIT_CONFIG.mmj.color : id <= 12 ? UNIT_CONFIG.vbs.color : id <= 16 ? UNIT_CONFIG.wxs.color : UNIT_CONFIG.n25.color;

export default function CharacterRankRadar({ characterRanks }: Props) {
    const { themeColor } = useTheme();
    const [unit, setUnit] = useState<UnitKey>("overview");
    const [mobile, setMobile] = useState(false);
    const [points, setPoints] = useState<Array<{ x: number; y: number; lx: number; ly: number; color: string; value: number }>>([]);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const chartRef = useRef<ReactECharts>(null);

    useEffect(() => {
        const fn = () => setMobile(window.innerWidth <= 420);
        fn(); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
    }, []);

    const orderedIds = useMemo(() => {
        const ids = UNIT_CONFIG[unit].ids;
        return ids.length > 1 ? [ids[0], ...ids.slice(1).reverse()] : ids;
    }, [unit]);

    const chartData = useMemo(() => {
        const raw = orderedIds.map((id) => characterRanks.get(id) || 0);
        const m = Math.max(10, ...raw);
        const max = Math.ceil(m / 10) * 10;
        return { raw, max };
    }, [orderedIds, characterRanks]);

    const option = useMemo(() => ({
        animation: true,
        animationDuration: 600,
        animationDurationUpdate: 600,
        animationEasing: "cubicOut",
        animationEasingUpdate: "cubicInOut",
        radar: {
            startAngle: 90,
            clockwise: true,
            indicator: orderedIds.map((id) => ({ name: CHAR_NAMES[id] || `ID ${id}`, max: chartData.max })),
            center: ["50%", "54%"],
            radius: mobile ? (unit === "overview" ? "58%" : "64%") : (unit === "overview" ? "67%" : "74%"),
            splitNumber: 10,
            axisName: { color: "#6e6e6e", fontSize: mobile ? (unit === "overview" ? 9 : 10) : (unit === "overview" ? 10 : 12), fontWeight: 700 },
            splitLine: { lineStyle: { color: "rgba(110,110,110,0.15)" } },
            splitArea: { areaStyle: { color: ["rgba(200,224,227,0.2)", "rgba(200,224,227,0.35)"] } },
            axisLine: { lineStyle: { color: "rgba(110,110,110,0.25)" } },
        },
        series: [{
            type: "radar",
            data: [{
                value: chartData.raw,
                areaStyle: { color: `${(unit === "overview" ? themeColor : UNIT_CONFIG[unit].color)}33` },
                lineStyle: { color: unit === "overview" ? themeColor : UNIT_CONFIG[unit].color, width: 3 },
                symbol: "none",
            }],
        }],
    }), [orderedIds, chartData, unit, mobile, themeColor]);

    const refreshOverlay = useCallback(() => {
        const chart = chartRef.current?.getEchartsInstance();
        if (!chart) return;
        const width = chart.getWidth(); const height = chart.getHeight(); const n = chartData.raw.length;
        if (!width || !height || !n || chartData.max <= 0) return setPoints([]);
        const c = chart.convertToPixel({ radarIndex: 0 } as never, [0, 0]) as number[] | undefined;
        const cx = c?.[0] ?? width * 0.5; const cy = c?.[1] ?? height * 0.54;
        const labelOffset = mobile ? (unit === "overview" ? 8 : 10) : (unit === "overview" ? 12 : 14);
        const next = chartData.raw.map((pv, i) => {
            const axisIndex = i === 0 ? 0 : n - i;
            const ac = chart.convertToPixel({ radarIndex: 0 } as never, [axisIndex, chartData.max]) as number[] | undefined;
            const norm = Math.max(0, Math.min(pv / chartData.max, 1));
            let x: number;
            let y: number;
            if (ac && ac.length >= 2 && Number.isFinite(ac[0]) && Number.isFinite(ac[1])) {
                x = cx + (ac[0] - cx) * norm;
                y = cy + (ac[1] - cy) * norm;
            } else {
                const angle = -Math.PI / 2 + (Math.PI * 2 * axisIndex) / n;
                const radius = Math.min(width, height) * 0.5 * (mobile ? (unit === "overview" ? 0.58 : 0.64) : (unit === "overview" ? 0.67 : 0.74));
                x = cx + Math.cos(angle) * radius * norm;
                y = cy + Math.sin(angle) * radius * norm;
            }
            const vx = x - cx; const vy = y - cy; const len = Math.hypot(vx, vy) || 1;
            const cid = orderedIds[i];
            return { x, y, lx: x + (vx / len) * labelOffset, ly: y + (vy / len) * labelOffset, color: unit === "overview" ? unitColor(cid) : UNIT_CONFIG[unit].color, value: Math.round(pv || 0) };
        });
        setSize({ width, height }); setPoints(next);
    }, [chartData, orderedIds, unit, mobile]);

    return (
        <div id="profile-character-related" className="scroll-mt-20 glass-card p-5 sm:p-6 rounded-2xl h-full">
            <div className="mb-4">
                <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                    <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: themeColor }}></span>
                    角色等级
                </h2>
            </div>

            <div className={`mb-5 ${mobile ? "" : "overflow-x-auto snap-x snap-mandatory"}`}>
                <div className={mobile ? "grid grid-cols-7 gap-1.5" : "flex gap-3 min-w-max pb-1"}>
                    {(["overview", "ln", "mmj", "vbs", "wxs", "n25", "vs"] as UnitKey[]).map((k) => {
                        const u = UNIT_CONFIG[k]; const active = unit === k;
                        return (
                            <button
                                key={k}
                                onClick={() => setUnit(k)}
                                className={`${mobile ? "p-1 rounded-lg min-w-0" : "p-1.5 rounded-xl shrink-0 snap-start"} border flex items-center justify-center transition-all ${active
                                    ? "bg-white"
                                    : "bg-white/70 border-slate-200 text-slate-500 hover:border-slate-300"
                                    }`}
                                style={active
                                    ? {
                                        color: themeColor,
                                        borderColor: themeColor,
                                        boxShadow: `0 0 0 2px ${themeColor}1f`,
                                    }
                                    : undefined}
                                title={u.label}
                            >
                                <div className={`${mobile ? "w-6 h-6" : "w-8 h-8"} relative flex items-center justify-center`}>
                                    {k === "overview"
                                        ? <span className={`${mobile ? "text-[10px]" : "text-[12px]"} font-black leading-tight`}>总览</span>
                                        : <img src={u.icon} alt={u.label} className={`${mobile ? "w-6 h-6" : "w-8 h-8"} object-contain`} loading="lazy" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="relative h-[340px] sm:h-[460px]">
                <ReactECharts
                    ref={chartRef}
                    option={option}
                    notMerge={false}
                    lazyUpdate={true}
                    style={{ width: "100%", height: "100%", cursor: "default" }}
                    opts={{ renderer: "svg" }}
                    onChartReady={refreshOverlay}
                    onEvents={{ finished: refreshOverlay }}
                />
                <svg className="absolute inset-0 pointer-events-none" width={size.width} height={size.height}>
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r={mobile ? 2.5 : 4.5} fill={p.color} stroke="#fff" strokeWidth={2} />
                            <text x={p.lx} y={p.ly} fill="#4b5563" fontSize={mobile ? (unit === "overview" ? 10 : 11) : (unit === "overview" ? 12 : 13)} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{p.value}</text>
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
}
