"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData, fetchMasterDataForServer } from "@/lib/fetch";
import { IEventInfo } from "@/types/events";
import { loadTranslations, TranslationData } from "@/lib/translations";
import { useTheme } from "@/contexts/ThemeContext";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";
import { StoryPageHeader } from "@/components/story/StoryPageHeader";

// Minimal actionSet type
interface IActionSet {
    id: number;
    areaId: number;
    releaseConditionId: number;
    scenarioId?: string;
    actionSetType?: string;
    isNextGrade?: boolean;
}

interface IArea { id: number; name: string; subName?: string; }

// Area category type (mirrors Python __get_category)
type AreaCategory = number | "grade1" | "grade2" | "theater" | string; // string covers limited_N, aprilfoolYYYY

function getCategory(action: IActionSet): AreaCategory | "" {
    const cond = String(action.releaseConditionId);
    if (action.scenarioId && cond.length === 6 && cond[0] === "1") {
        return parseInt(cond.slice(1, 4), 10) + 1;
    }
    if (action.id === 2373) return 145;
    if (
        action.scenarioId &&
        action.actionSetType === "normal" &&
        action.isNextGrade === false &&
        action.releaseConditionId === 1
    ) return "grade1";
    if (
        action.scenarioId &&
        action.actionSetType === "normal" &&
        action.isNextGrade === true &&
        action.releaseConditionId === 1
    ) return "grade2";
    if (action.scenarioId && action.releaseConditionId >= 2000000 && action.releaseConditionId <= 2000036) {
        return "theater";
    }
    if (action.scenarioId && action.actionSetType === "limited" && !action.scenarioId.includes("aprilfool")) {
        return `limited_${action.areaId}`;
    }
    if (action.scenarioId && action.actionSetType === "limited" && action.scenarioId.includes("aprilfool")) {
        return action.scenarioId.split("_")[1]; // e.g. "aprilfool2022"
    }
    return "";
}

function categoryToUrlParam(cat: AreaCategory): string {
    if (typeof cat === "number") return `event_${cat}`;
    return cat;
}

function categoryLabel(cat: AreaCategory, eventMap: Map<number, string>, translations: TranslationData | null, areaMap?: Map<number, IArea>): string {
    if (typeof cat === "number") {
        const name = eventMap.get(cat);
        if (!name) return `活动 ${cat}`;
        const cnName = translations?.events?.name?.[name];
        return cnName && cnName !== name
            ? `活动 ${cat}：${name}（${cnName}）`
            : `活动 ${cat}：${name}`;
    }
    if (cat === "grade1") return "日常对话（第一学年）";
    if (cat === "grade2") return "日常对话（第二学年）";
    if (cat === "theater") return "剧场版";
    if (cat.startsWith("limited_")) {
        const areaId = parseInt(cat.replace("limited_", ""), 10);
        const area = areaMap?.get(areaId);
        if (area) {
            const name = area.subName ? `${area.name} - ${area.subName}` : area.name;
            return `限定：${name}`;
        }
        return `限定区域 ${areaId}`;
    }
    if (cat.startsWith("aprilfool")) return `愚人节 ${cat.replace("aprilfool", "")}`;
    return cat;
}

export default function StoryAreaListClient() {
    const { serverSource } = useTheme();
    const [actionSets, setActionSets] = useState<IActionSet[]>([]);
    const [events, setEvents] = useState<IEventInfo[]>([]);
    const [areas, setAreas] = useState<IArea[]>([]);
    const [translations, setTranslations] = useState<TranslationData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    useSimpleScrollRestore("story_area", !isLoading);

    useEffect(() => {
        async function load() {
            try {
                const [actionSetsData, eventsData, areasData, translationsData] = await Promise.all([
                    fetchMasterDataForServer<IActionSet[]>("jp", "actionSets.json"),
                    fetchMasterData<IEventInfo[]>("events.json"),
                    fetchMasterData<IArea[]>("areas.json"),
                    loadTranslations(),
                ]);
                setActionSets(actionSetsData);
                setEvents(eventsData);
                setAreas(areasData);
                setTranslations(translationsData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [serverSource]);

    const eventMap = useMemo(() => new Map(events.map(e => [e.id, e.name])), [events]);
    const areaMap = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);

    // Collect all unique categories
    const categories = useMemo(() => {
        const seen = new Set<string>();
        const result: AreaCategory[] = [];
        for (const action of actionSets) {
            const cat = getCategory(action);
            if (cat === "") continue;
            const key = String(cat);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(cat);
            }
        }
        // Sort: numbers (events) first desc, then strings
        result.sort((a, b) => {
            if (typeof a === "number" && typeof b === "number") return b - a;
            if (typeof a === "number") return -1;
            if (typeof b === "number") return 1;
            return String(a).localeCompare(String(b));
        });
        return result;
    }, [actionSets]);

    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return categories;
        const q = searchQuery.toLowerCase();
        return categories.filter(cat => {
            const label = categoryLabel(cat, eventMap, translations).toLowerCase();
            return label.includes(q) || String(cat).toLowerCase().includes(q);
        });
    }, [categories, searchQuery, eventMap, translations]);

    // Group: events, grade, theater, limited, aprilfool
    const grouped = useMemo(() => {
        const eventCats = filteredCategories.filter(c => typeof c === "number") as number[];
        const gradeCats = filteredCategories.filter(c => c === "grade1" || c === "grade2");
        const theaterCats = filteredCategories.filter(c => c === "theater");
        const limitedCats = filteredCategories.filter(c => typeof c === "string" && c.startsWith("limited_"));
        const aprilfoolCats = filteredCategories.filter(c => typeof c === "string" && c.startsWith("aprilfool"));
        return { eventCats, gradeCats, theaterCats, limitedCats, aprilfoolCats };
    }, [filteredCategories]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <StoryPageHeader storyKey="area" />

                <input
                    type="text"
                    placeholder="搜索分类名称..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full mb-6 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-miku/30"
                />

                {isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin"></div>
                    </div>
                )}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="space-y-4">
                        {/* Grade & Theater — 默认展开 */}
                        {(grouped.gradeCats.length > 0 || grouped.theaterCats.length > 0) && (
                            <Section title="日常 / 剧场" storageKey="grade_theater">
                                {[...grouped.gradeCats, ...grouped.theaterCats].map(cat => (
                                    <CategoryLink key={String(cat)} cat={cat} eventMap={eventMap} translations={translations} areaMap={areaMap} />
                                ))}
                            </Section>
                        )}
                        {grouped.eventCats.length > 0 && (
                            <Section title={`活动对话（${grouped.eventCats.length} 个）`} storageKey="events">
                                {grouped.eventCats.map(cat => (
                                    <CategoryLink key={String(cat)} cat={cat} eventMap={eventMap} translations={translations} areaMap={areaMap} />
                                ))}
                            </Section>
                        )}
                        {grouped.limitedCats.length > 0 && (
                            <Section title="限定区域" storageKey="limited">
                                {grouped.limitedCats.map(cat => (
                                    <CategoryLink key={String(cat)} cat={cat} eventMap={eventMap} translations={translations} areaMap={areaMap} />
                                ))}
                            </Section>
                        )}
                        {grouped.aprilfoolCats.length > 0 && (
                            <Section title="愚人节" storageKey="aprilfool">
                                {grouped.aprilfoolCats.map(cat => (
                                    <CategoryLink key={String(cat)} cat={cat} eventMap={eventMap} translations={translations} areaMap={areaMap} />
                                ))}
                            </Section>
                        )}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}

function Section({ title, storageKey, children }: { title: string; storageKey: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(() => {
        try {
            const saved = sessionStorage.getItem(`area_section_${storageKey}`);
            return saved === null ? true : saved === "1";
        } catch { return true; }
    });

    const toggle = () => {
        const next = !open;
        setOpen(next);
        try { sessionStorage.setItem(`area_section_${storageKey}`, next ? "1" : "0"); } catch { /* ignore */ }
    };

    return (
        <div>
            <button onClick={toggle} className="flex items-center gap-1.5 mb-3 group">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-miku transition-colors">{title}</h2>
                <svg
                    className={`w-4 h-4 text-slate-400 group-hover:text-miku transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="space-y-1.5">{children}</div>}
        </div>
    );
}

function CategoryLink({ cat, eventMap, translations, areaMap }: { cat: AreaCategory; eventMap: Map<number, string>; translations: TranslationData | null; areaMap?: Map<number, IArea> }) {
    const label = categoryLabel(cat, eventMap, translations, areaMap);
    const urlParam = categoryToUrlParam(cat);
    return (
        <Link
            href={`/story/area/${encodeURIComponent(urlParam)}`}
            className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-sm transition-all group"
        >
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-miku transition-colors">{label}</span>
            <svg className="w-4 h-4 text-slate-300 group-hover:text-miku transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
        </Link>
    );
}
