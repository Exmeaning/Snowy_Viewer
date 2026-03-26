"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData, fetchMasterDataForServer } from "@/lib/fetch";
import { IEventInfo } from "@/types/events";
import { loadTranslations } from "@/lib/translations";
import { useTheme } from "@/contexts/ThemeContext";

interface IActionSet {
    id: number; areaId: number; releaseConditionId: number;
    scenarioId?: string; actionSetType?: string; isNextGrade?: boolean;
}
interface IArea { id: number; name: string; subName?: string; }

type AreaCategory = number | string;

function getCategory(action: IActionSet): AreaCategory | "" {
    const cond = String(action.releaseConditionId);
    if (action.scenarioId && cond.length === 6 && cond[0] === "1") return parseInt(cond.slice(1, 4), 10) + 1;
    if (action.id === 2373) return 145;
    if (action.scenarioId && action.actionSetType === "normal" && action.isNextGrade === false && action.releaseConditionId === 1) return "grade1";
    if (action.scenarioId && action.actionSetType === "normal" && action.isNextGrade === true && action.releaseConditionId === 1) return "grade2";
    if (action.scenarioId && action.releaseConditionId >= 2000000 && action.releaseConditionId <= 2000036) return "theater";
    if (action.scenarioId && action.actionSetType === "limited" && !action.scenarioId.includes("aprilfool")) return `limited_${action.areaId}`;
    if (action.scenarioId && action.actionSetType === "limited" && action.scenarioId.includes("aprilfool")) return action.scenarioId.split("_")[1];
    return "";
}

function urlParamToCategory(param: string): AreaCategory {
    if (param.startsWith("event_")) return parseInt(param.slice(6), 10);
    return param;
}

function getTalkTypeLabel(action: IActionSet, cat: AreaCategory): string {
    if (typeof cat !== "number") return "";
    const sid = action.scenarioId ?? "";
    if (sid.includes("_ev_")) return "活动";
    if (sid.includes("_wl_")) return "WL";
    if (sid.includes("_monthly")) return "月刊";
    if (sid.includes("_add_")) return "追加";
    return "";
}

export default function StoryAreaDetailClient() {
    const params = useParams();
    const { serverSource } = useTheme();
    const areaIdParam = decodeURIComponent(params.areaId as string);
    const category = urlParamToCategory(areaIdParam);

    const [actions, setActions] = useState<IActionSet[]>([]);
    const [areaMap, setAreaMap] = useState<Map<number, IArea>>(new Map());
    const [eventName, setEventName] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [actionSetsData, areasData, eventsData, translationsData] = await Promise.all([
                    fetchMasterDataForServer<IActionSet[]>("jp", "actionSets.json"),
                    fetchMasterData<IArea[]>("areas.json"),
                    fetchMasterData<IEventInfo[]>("events.json"),
                    loadTranslations(),
                ]);
                setAreaMap(new Map(areasData.map(a => [a.id, a])));
                const matched = actionSetsData.filter(a => getCategory(a) === category);
                if (matched.length === 0) throw new Error("未找到对应的区域对话");
                setActions(matched);

                if (typeof category === "number") {
                    const ev = eventsData.find(e => e.id === category);
                    if (ev) {
                        const cn = translationsData?.events?.name?.[ev.name] ?? ev.name;
                        setEventName(cn);
                        document.title = `活动 ${category}：${cn} - 区域对话 - Moesekai`;
                    }
                } else {
                    const labels: Record<string, string> = { grade1: "日常对话（一年级）", grade2: "日常对话（二年级）", theater: "剧场对话" };
                    const label = labels[category as string]
                        ?? (String(category).startsWith("limited_") ? `限定区域 ${String(category).replace("limited_", "")}` : `愚人节 ${String(category).replace("aprilfool", "")}`)
                    document.title = `${label} - 区域对话 - Moesekai`;
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [areaIdParam, serverSource]);

    const pageTitle = useMemo(() => {
        if (typeof category === "number") return eventName ? `活动 ${category}：${eventName}` : `活动 ${category}`;
        const labels: Record<string, string> = { grade1: "日常对话（一年级）", grade2: "日常对话（二年级）", theater: "剧场对话" };
        return labels[category as string]
            ?? (String(category).startsWith("limited_") ? `限定区域 ${String(category).replace("limited_", "")}` : `愚人节 ${String(category).replace("aprilfool", "")}`);
    }, [category, eventName]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/story/area" className="inline-flex items-center gap-2 text-slate-500 hover:text-miku transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回分类列表
                </Link>

                <div className="mb-6">
                    <h1 className="text-xl font-black text-primary-text">{pageTitle}</h1>
                    {!isLoading && !error && <p className="text-sm text-slate-500 mt-1">共 {actions.length} 条对话</p>}
                </div>

                {isLoading && <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin" /></div>}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="space-y-2">
                        {actions.map((action, idx) => {
                            const area = areaMap.get(action.areaId);
                            const areaName = area ? (area.subName ? `${area.name} - ${area.subName}` : area.name) : `区域 ${action.areaId}`;
                            const typeLabel = getTalkTypeLabel(action, category);
                            return (
                                <Link
                                    key={action.id}
                                    href={`/story/area/${encodeURIComponent(areaIdParam)}/${action.id}`}
                                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-sm transition-all group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-miku transition-colors">{areaName}</span>
                                                {typeLabel && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded">{typeLabel}</span>}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">ID: {action.id}</p>
                                        </div>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-300 group-hover:text-miku transition-colors shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
