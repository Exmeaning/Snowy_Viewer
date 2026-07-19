"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { fetchMasterData } from "@/lib/fetch";
import { getCharacterIconUrl } from "@/lib/assets";
import { IEventInfo } from "@/types/events";
import { loadTranslations } from "@/lib/translations";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useSimpleScrollRestore } from "@/hooks/useSimpleScrollRestore";
import { getAreaCategory, urlParamToCategory, type IActionSet, type AreaCategory } from "../areaCategory";

type TranslationFn = ReturnType<typeof useI18n>["t"];

interface IArea { id: number; name: string; subName?: string; }
interface ICharacter2D {
    id: number; characterType: string; characterId: number;
}

function getTalkTypeLabel(action: IActionSet, cat: AreaCategory, t: TranslationFn): string {
    if (typeof cat !== "number") return "";
    const sid = action.scenarioId ?? "";
    if (sid.includes("_ev_")) return t("page.story.area.talkType.event");
    if (sid.includes("_wl_")) return t("page.story.area.talkType.wl");
    if (sid.includes("_monthly")) return t("page.story.area.talkType.monthly");
    if (sid.includes("_add_")) return t("page.story.area.talkType.additional");
    return "";
}

function getStaticCategoryLabel(category: AreaCategory, t: TranslationFn): string {
    if (typeof category === "number") return t("page.story.area.eventCategoryFallback", { id: category });
    if (category === "grade1") return t("page.story.area.grade1Label");
    if (category === "grade2") return t("page.story.area.grade2Label");
    if (category === "theater") return t("page.story.area.theaterLabel");
    if (category.startsWith("limited_")) return t("page.story.area.limitedCategoryFallback", { id: category.replace("limited_", "") });
    if (category.startsWith("aprilfool")) return t("page.story.area.aprilFoolCategory", { year: category.replace("aprilfool", "") });
    return category;
}

export default function StoryAreaDetailClient() {
    const params = useParams();
    const { serverSource } = useTheme();
    const { t } = useI18n();
    const areaIdParam = decodeURIComponent(params.category as string);
    const category = urlParamToCategory(areaIdParam);

    const [actions, setActions] = useState<IActionSet[]>([]);
    const [areaMap, setAreaMap] = useState<Map<number, IArea>>(new Map());
    const [chara2dMap, setChara2dMap] = useState<Map<number, number>>(new Map());
    const [eventName, setEventName] = useState<string>("");
    const [eventNameCn, setEventNameCn] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useSimpleScrollRestore(`story_area_${areaIdParam}`, !isLoading);

    useEffect(() => {
        async function load() {
            try {
                const [actionSetsData, areasData, eventsData, translationsData, chara2dsData] = await Promise.all([
                    fetchMasterData<IActionSet[]>("actionSets.json"),
                    fetchMasterData<IArea[]>("areas.json"),
                    fetchMasterData<IEventInfo[]>("events.json"),
                    loadTranslations(),
                    fetchMasterData<ICharacter2D[]>("character2ds.json"),
                ]);
                setAreaMap(new Map(areasData.map(a => [a.id, a])));

                // Build character2dId → gameCharacterId map (game_character only)
                const c2dMap = new Map<number, number>();
                for (const c of chara2dsData) {
                    if (c.characterType === "game_character") {
                        c2dMap.set(c.id, c.characterId);
                    }
                }
                setChara2dMap(c2dMap);

                const matched = actionSetsData.filter(a => getAreaCategory(a) === category);
                if (matched.length === 0) throw new Error(t("page.story.area.categoryNotFound"));
                setActions(matched);

                if (typeof category === "number") {
                    const ev = eventsData.find(e => e.id === category);
                    if (ev) {
                        const cn = translationsData?.events?.name?.[ev.name];
                        setEventName(ev.name);
                        setEventNameCn(cn && cn !== ev.name ? cn : "");
                        const displayName = cn && cn !== ev.name
                            ? t("page.story.area.eventCategoryWithTranslation", { id: category, name: ev.name, translation: cn })
                            : t("page.story.area.eventCategory", { id: category, name: ev.name });
                        document.title = t("page.story.area.documentTitle", { name: displayName });
                    }
                } else {
                    document.title = t("page.story.area.documentTitle", { name: getStaticCategoryLabel(category, t) });
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : t("common.state.loadingFailed"));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [areaIdParam, serverSource, t]);

    const pageTitle = useMemo(() => {
        if (typeof category === "number") {
            if (!eventName) return t("page.story.area.eventCategoryFallback", { id: category });
            return eventNameCn
                ? t("page.story.area.eventCategoryWithTranslation", { id: category, name: eventName, translation: eventNameCn })
                : t("page.story.area.eventCategory", { id: category, name: eventName });
        }
        return getStaticCategoryLabel(category, t);
    }, [category, eventName, eventNameCn, t]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <Link href="/story/area" className="inline-flex items-center gap-2 text-slate-500 hover:text-miku transition-colors mb-6">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("page.story.area.backToCategories")}
                </Link>

                <div className="mb-6">
                    <h1 className="text-xl font-black text-primary-text">{pageTitle}</h1>
                    {!isLoading && !error && <p className="text-sm text-slate-500 mt-1">{t("page.story.area.dialogueCount", { count: actions.length })}</p>}
                </div>

                {isLoading && <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-miku/30 border-t-miku rounded-full animate-spin" /></div>}
                {error && <div className="text-red-500 text-center py-8">{error}</div>}

                {!isLoading && !error && (
                    <div className="space-y-2">
                        {actions.map((action, idx) => {
                            const area = areaMap.get(action.areaId);
                            const areaName = area ? (area.subName ? `${area.name} - ${area.subName}` : area.name) : t("page.story.area.areaFallback", { id: action.areaId });
                            const typeLabel = getTalkTypeLabel(action, category, t);

                            // Resolve characterIds (character2d ids) → gameCharacter ids (1-26) and sort
                            const gameCharaIds = [...new Set(
                                (action.characterIds ?? [])
                                    .map(c2dId => chara2dMap.get(c2dId))
                                    .filter((id): id is number => id !== undefined && id >= 1 && id <= 26)
                            )].sort((a, b) => a - b);

                            return (
                                <Link
                                    key={action.id}
                                    href={`/story/area/${encodeURIComponent(areaIdParam)}/${encodeURIComponent(action.scenarioId ?? "")}`}
                                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-miku/50 hover:shadow-sm transition-all group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Character avatars */}
                                        {gameCharaIds.length > 0 ? (
                                            <div className="flex shrink-0 -space-x-2">
                                                {gameCharaIds.map(charaId => (
                                                    <img
                                                        key={charaId}
                                                        src={getCharacterIconUrl(charaId)}
                                                        alt=""
                                                        className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 object-cover"
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                                {idx + 1}
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-miku transition-colors">{areaName}</span>
                                                {typeLabel && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded">{typeLabel}</span>}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">ID: {action.id}:{action.scenarioId}</p>
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
