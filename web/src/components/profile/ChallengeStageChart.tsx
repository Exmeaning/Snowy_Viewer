"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import ReactECharts from "echarts-for-react";
import { CHAR_NAMES, CHAR_COLORS, UNIT_NAME_MAP } from "@/types/types";
import { fetchMasterDataForServer } from "@/lib/fetch";
import { getCharacterIconUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import Modal from "@/components/common/Modal";
import type {
    ServerType,
    UserChallengeLiveSoloHighScoreReward,
    UserChallengeLiveSoloResult,
    UserChallengeLiveSoloStage,
} from "@/lib/account";

interface Props {
    challengeStageRanks: Map<number, number>;
    server: ServerType;
    challengeSoloStages: UserChallengeLiveSoloStage[];
    challengeSoloResults: UserChallengeLiveSoloResult[];
    challengeHighScoreRewards: UserChallengeLiveSoloHighScoreReward[];
}

interface Row { characterId: number; rank: number; score: number; remainJewel: number; remainFragment: number; }
interface RewardMaster { id: number; characterId: number; resourceBoxId: number; }
interface BoxDetail { resourceType?: string; resourceId?: number; resourceQuantity?: number; }
interface BoxMaster { id: number; resourceBoxPurpose?: string; details?: BoxDetail[]; }
interface BoxDetailMasterRow {
    resourceBoxPurpose?: string;
    resourceBoxId: number;
    resourceType?: string;
    resourceId?: number | null;
    resourceQuantity?: number | null;
}
interface CharMaster { id: number; firstName?: string; givenName?: string; }
interface UnitMaster { unit: string; unitName: string; }

const GROUPS = [
    { key: "ln" as const, unit: "light_sound", name: UNIT_NAME_MAP.light_sound, icon: "/data/icon/ln.webp", ids: [1, 2, 3, 4] },
    { key: "mmj" as const, unit: "idol", name: UNIT_NAME_MAP.idol, icon: "/data/icon/mmj.webp", ids: [5, 6, 7, 8] },
    { key: "vbs" as const, unit: "street", name: UNIT_NAME_MAP.street, icon: "/data/icon/vbs.webp", ids: [9, 10, 11, 12] },
    { key: "wxs" as const, unit: "theme_park", name: UNIT_NAME_MAP.theme_park, icon: "/data/icon/wxs.webp", ids: [13, 14, 15, 16] },
    { key: "n25" as const, unit: "school_refusal", name: UNIT_NAME_MAP.school_refusal, icon: "/data/icon/n25.webp", ids: [17, 18, 19, 20] },
    { key: "vs" as const, unit: "piapro", name: UNIT_NAME_MAP.piapro, icon: "/data/icon/vs.webp", ids: [21, 22, 23, 24, 25, 26] },
];

const CHALLENGE_BOX_PURPOSE = "challenge_live_high_score";
const scoreCap = (s: ServerType) => (s === "jp" ? 3000000 : 2500000);
const rewardId = (x: UserChallengeLiveSoloHighScoreReward) => Number(x.challengeLiveHighScoreRewardId ?? x.challengeLiveSoloHighScoreRewardId ?? x.rewardId ?? 0) || null;
const rewardCid = (x: UserChallengeLiveSoloHighScoreReward) => Number(x.characterId ?? x.gameCharacterId ?? 0) || null;
const boxKey = (purpose: string, boxId: number) => `${purpose}#${boxId}`;

function collectBox(resourceMap: Map<number, BoxMaster>, root: number): { jewel: number; frag: number } {
    let jewel = 0; let frag = 0;
    const stack = [root]; const visited = new Set<number>();
    while (stack.length) {
        const id = stack.pop()!;
        if (visited.has(id)) continue;
        visited.add(id);
        for (const d of resourceMap.get(id)?.details || []) {
            const t = String(d.resourceType || "").toLowerCase();
            const rid = Number(d.resourceId || 0);
            const q = Number(d.resourceQuantity || 0);
            if (!q) continue;
            if (t.includes("jewel")) jewel += q;
            else if (t === "material" && rid === 15) frag += q;
            else if (t.includes("box")) stack.push(rid);
        }
    }
    return { jewel, frag };
}

export default function ChallengeStageChart({
    challengeStageRanks, server, challengeSoloStages, challengeSoloResults, challengeHighScoreRewards,
}: Props) {
    const { themeColor, serverSource } = useTheme();
    const [mobile, setMobile] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [rows, setRows] = useState<Row[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [charNames, setCharNames] = useState<Map<number, string>>(new Map());
    const [unitNames, setUnitNames] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const fn = () => setMobile(window.innerWidth <= 420);
        fn(); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
    }, []);

    useEffect(() => { setRows(null); setShowDetail(false); setError(null); setLoading(false); }, [server, serverSource, challengeSoloStages, challengeSoloResults, challengeHighScoreRewards]);

    // Sort characters by rank descending for bar chart
    const sortedChars = useMemo(() => {
        const entries: { id: number; rank: number }[] = [];
        for (let i = 1; i <= 26; i++) {
            entries.push({ id: i, rank: challengeStageRanks.get(i) || 0 });
        }
        return entries.sort((a, b) => b.rank - a.rank);
    }, [challengeStageRanks]);

    const barOption = useMemo(() => ({
        animation: true,
        animationDuration: 800,
        animationEasing: "cubicOut",
        tooltip: {
            trigger: "axis" as const,
            axisPointer: { type: "shadow" as const },
            formatter: (params: Array<{ name: string; value: number }>) => {
                const p = params[0];
                return `${p.name}<br/>等级: <b>${p.value}</b>`;
            },
        },
        grid: {
            left: mobile ? 8 : 12,
            right: mobile ? 8 : 12,
            top: 16,
            bottom: mobile ? 44 : 54,
            containLabel: false,
        },
        xAxis: {
            type: "category" as const,
            data: sortedChars.map((c) => CHAR_NAMES[c.id] || `ID ${c.id}`),
            axisLabel: {
                fontSize: mobile ? 8 : 10,
                color: "#6e6e6e",
                rotate: mobile ? 60 : 45,
                fontWeight: 600,
            },
            axisLine: { lineStyle: { color: "rgba(110,110,110,0.2)" } },
            axisTick: { show: false },
        },
        yAxis: {
            type: "value" as const,
            axisLabel: {
                fontSize: 10,
                color: "#9ca3af",
            },
            splitLine: { lineStyle: { color: "rgba(110,110,110,0.1)" } },
            axisLine: { show: false },
        },
        series: [{
            type: "bar",
            data: sortedChars.map((c) => ({
                value: c.rank,
                itemStyle: {
                    color: CHAR_COLORS[String(c.id)] || "#999",
                    borderRadius: [3, 3, 0, 0],
                },
            })),
            barMaxWidth: mobile ? 14 : 20,
            emphasis: {
                itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.15)" },
            },
        }],
    }), [sortedChars, mobile]);

    const loadDetail = useCallback(async () => {
        if (loading || rows) return;
        setLoading(true); setError(null);
        try {
                const nameServer: "jp" | "cn" = "cn"; // Always use CN for Chinese names
            const [rewardPack, chars, units] = await Promise.all([
                (async () => {
                    const loadPack = async (targetServer: ServerType) => {
                        const [rewards, boxes, boxDetails] = await Promise.all([
                            fetchMasterDataForServer<RewardMaster[]>(targetServer, "challengeLiveHighScoreRewards.json"),
                            fetchMasterDataForServer<BoxMaster[]>(targetServer, "resourceBoxes.json"),
                            fetchMasterDataForServer<BoxDetailMasterRow[]>(targetServer, "resourceBoxDetails.json").catch(() => []),
                        ]);
                        return { rewards, boxes, boxDetails };
                    };

                    const current = await loadPack(server);
                    if (current.rewards.length) return current;
                    return loadPack("jp");
                })(),
                fetchMasterDataForServer<CharMaster[]>(nameServer, "gameCharacters.json"),
                fetchMasterDataForServer<UnitMaster[]>(nameServer, "unitProfiles.json"),
            ]);

            const cMap = new Map<number, string>();
            chars.forEach((c) => { const n = `${c.firstName || ""}${c.givenName || ""}`.trim() || c.givenName || c.firstName; if (n) cMap.set(c.id, n); });
            setCharNames(cMap);
            const uMap = new Map<string, string>();
            units.forEach((u) => { if (u.unit && u.unitName) uMap.set(u.unit, u.unitName); });
            setUnitNames(uMap);

            const rewardById = new Map<number, RewardMaster>(); rewardPack.rewards.forEach((r) => rewardById.set(r.id, r));
            const completed = new Map<number, Set<number>>();
            challengeHighScoreRewards.forEach((x) => {
                const rid = rewardId(x); if (!rid) return;
                const cid = rewardCid(x) || rewardById.get(rid)?.characterId || 0; if (!cid) return;
                const set = completed.get(cid) || new Set<number>(); set.add(rid); completed.set(cid, set);
            });
            const rewardsByChar = new Map<number, RewardMaster[]>();
            rewardPack.rewards.forEach((r) => { const arr = rewardsByChar.get(r.characterId) || []; arr.push(r); rewardsByChar.set(r.characterId, arr); });
            const scoreBy = new Map<number, number>(); challengeSoloResults.forEach((x) => scoreBy.set(x.characterId, x.highScore || 0));
            const rankBy = new Map<number, number>(); challengeSoloStages.forEach((x) => rankBy.set(x.characterId, Math.max(rankBy.get(x.characterId) || 0, x.rank || 0)));

            const boxDetailsByKey = new Map<string, BoxDetail[]>();
            rewardPack.boxDetails.forEach((d) => {
                const purpose = d.resourceBoxPurpose || "";
                if (!purpose || !d.resourceBoxId) return;
                const key = boxKey(purpose, d.resourceBoxId);
                const arr = boxDetailsByKey.get(key) || [];
                arr.push({
                    resourceType: d.resourceType,
                    resourceId: typeof d.resourceId === "number" ? d.resourceId : undefined,
                    resourceQuantity: typeof d.resourceQuantity === "number" ? d.resourceQuantity : undefined,
                });
                boxDetailsByKey.set(key, arr);
            });

            const rewardBoxIds = new Set<number>();
            rewardPack.rewards.forEach((r) => rewardBoxIds.add(r.resourceBoxId));
            const scopedBoxes = rewardPack.boxes.filter((b) => (b.resourceBoxPurpose || "") === CHALLENGE_BOX_PURPOSE);
            const preferredBoxes = new Map<number, BoxMaster>();
            rewardPack.boxes.forEach((b) => {
                if (!rewardBoxIds.has(b.id)) return;
                const prev = preferredBoxes.get(b.id);
                if (!prev || ((b.resourceBoxPurpose || "") === CHALLENGE_BOX_PURPOSE && (prev.resourceBoxPurpose || "") !== CHALLENGE_BOX_PURPOSE)) {
                    preferredBoxes.set(b.id, b);
                }
            });

            const sourceBoxes = scopedBoxes.length ? scopedBoxes : Array.from(preferredBoxes.values());
            const boxMap = new Map<number, BoxMaster>();
            sourceBoxes.forEach((b) => {
                const purpose = b.resourceBoxPurpose || (scopedBoxes.length ? CHALLENGE_BOX_PURPOSE : "");
                const details = (b.details && b.details.length)
                    ? b.details
                    : (boxDetailsByKey.get(boxKey(purpose, b.id)) || []);
                boxMap.set(b.id, { ...b, details });
            });

            const next: Row[] = [];
            for (let cid = 1; cid <= 26; cid += 1) {
                const done = completed.get(cid) || new Set<number>();
                let jewel = 0; let frag = 0;
                (rewardsByChar.get(cid) || []).forEach((r) => {
                    if (done.has(r.id)) return;
                    const am = collectBox(boxMap, r.resourceBoxId); jewel += am.jewel; frag += am.frag;
                });
                next.push({ characterId: cid, rank: rankBy.get(cid) || 0, score: scoreBy.get(cid) || 0, remainJewel: jewel, remainFragment: frag });
            }
            setRows(next);
        } catch {
            setError("挑战详情加载失败，请稍后重试");
        } finally {
            setLoading(false);
        }
    }, [loading, rows, server, serverSource, challengeHighScoreRewards, challengeSoloResults, challengeSoloStages]);

    const openDetail = useCallback(() => {
        setShowDetail(true);
        if (!rows && !loading) void loadDetail();
    }, [rows, loading, loadDetail]);

    const groupedRows = useMemo(() => {
        if (!rows) return [];
        const map = new Map(rows.map((r) => [r.characterId, r]));
        return GROUPS.map((g) => ({ ...g, rows: g.ids.map((id) => map.get(id)).filter((x): x is Row => Boolean(x)) }));
    }, [rows]);

    const remainTotals = useMemo(() => {
        if (!rows) return { jewel: 0, fragment: 0 };
        return rows.reduce(
            (acc, row) => ({
                jewel: acc.jewel + row.remainJewel,
                fragment: acc.fragment + row.remainFragment,
            }),
            { jewel: 0, fragment: 0 },
        );
    }, [rows]);

    return (
        <div id="profile-challenge-stage" className="scroll-mt-20 glass-card p-5 sm:p-6 rounded-2xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                    <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: themeColor }}></span>
                    挑战等级
                </h2>
                <button
                    onClick={openDetail}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-miku/40 hover:text-miku transition-colors"
                >
                    查看详情
                </button>
            </div>

            <div className="flex-1 min-h-[240px] sm:min-h-[300px] flex items-center">
                <div className="w-full h-[240px] sm:h-[300px]">
                    <ReactECharts
                        option={barOption}
                        notMerge={false}
                        lazyUpdate={true}
                        style={{ width: "100%", height: "100%" }}
                        opts={{ renderer: "svg" }}
                    />
                </div>
            </div>

            <Modal
                isOpen={showDetail}
                onClose={() => setShowDetail(false)}
                title="挑战信息详情"
                size="xl"
            >
                {loading && <div className="text-sm text-slate-500 py-8 text-center">正在加载挑战详情...</div>}
                {error && <div className="text-sm text-red-500 py-8 text-center">{error}</div>}
                {!loading && !error && groupedRows.length === 0 && (
                    <div className="text-sm text-slate-500 py-8 text-center">暂无挑战数据</div>
                )}
                {!loading && !error && groupedRows.length > 0 && (
                    <div>
                        {mobile ? (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-black text-slate-700">总计</span>
                                        <span className="text-xs font-bold text-slate-500">全部角色</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-lg bg-white px-2 py-1 text-slate-600">水晶 <span className="font-bold text-slate-700">{remainTotals.jewel.toLocaleString()}</span></div>
                                        <div className="rounded-lg bg-white px-2 py-1 text-slate-600">碎片 <span className="font-bold text-slate-700">{remainTotals.fragment.toLocaleString()}</span></div>
                                    </div>
                                </div>
                                {groupedRows.map((g) => (
                                    <div key={g.key} className="space-y-2">
                                        <div className="flex items-center gap-2 px-1 py-1 text-xs font-bold text-slate-600">{g.icon && <img src={g.icon} alt={g.name} className="w-4 h-4 object-contain" />}<span>{unitNames.get(g.unit) || g.name}</span></div>
                                        {g.rows.map((r) => {
                                            const prog = Math.max(0, Math.min((r.score / scoreCap(server)) * 100, 100));
                                            const cname = charNames.get(r.characterId) || CHAR_NAMES[r.characterId] || `ID ${r.characterId}`;
                                            return (
                                                <div key={r.characterId} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-200"><Image src={getCharacterIconUrl(r.characterId)} alt={cname} fill className="object-cover" unoptimized /></div>
                                                            <span className="text-sm font-semibold text-slate-700 truncate">{cname}</span>
                                                        </div>
                                                        <div className="text-xs font-bold text-slate-600">Lv {r.rank}</div>
                                                    </div>
                                                    <div className="text-sm font-bold text-slate-700">最高分 {r.score.toLocaleString()}</div>
                                                    <div className="h-3 rounded-full bg-slate-500/75 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${prog}%`, backgroundColor: themeColor }} /></div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="rounded-lg bg-slate-50 px-2 py-1 text-slate-600">水晶 <span className="font-bold text-slate-700">{r.remainJewel}</span></div>
                                                        <div className="rounded-lg bg-slate-50 px-2 py-1 text-slate-600">碎片 <span className="font-bold text-slate-700">{r.remainFragment}</span></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <div className="min-w-[840px] space-y-4">
                                    <div className="grid grid-cols-[170px_70px_130px_minmax(240px,1fr)_90px_110px] items-center gap-3 px-4 py-2 text-sm font-bold text-slate-600">
                                        <div className="text-left">角色</div>
                                        <div className="text-center">等级</div>
                                        <div className="text-center">最高分</div>
                                        <div className="text-center">{`进度（上限${server === "jp" ? "300w分" : "250w分"}）`}</div>
                                        <div className="text-center">剩余水晶</div>
                                        <div className="text-center">剩余心愿碎片</div>
                                    </div>
                                    <div className="grid grid-cols-[170px_70px_130px_minmax(240px,1fr)_90px_110px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2">
                                        <div className="text-sm font-black text-slate-700">总计</div>
                                        <div className="text-sm font-bold text-slate-400 text-center">-</div>
                                        <div className="text-sm font-bold text-slate-400 text-center">-</div>
                                        <div className="text-sm font-bold text-slate-400 text-center">-</div>
                                        <div className="text-sm font-black text-slate-700 text-center">{remainTotals.jewel.toLocaleString()}</div>
                                        <div className="text-sm font-black text-slate-700 text-center">{remainTotals.fragment.toLocaleString()}</div>
                                    </div>
                                    {groupedRows.map((g) => (
                                        <div key={g.key} className="space-y-2">
                                            <div className="flex items-center gap-2 px-3 py-1 text-xs font-bold text-slate-600">{g.icon && <img src={g.icon} alt={g.name} className="w-4 h-4 object-contain" />}<span>{unitNames.get(g.unit) || g.name}</span></div>
                                            <div className="space-y-2">
                                                {g.rows.map((r) => {
                                                    const prog = Math.max(0, Math.min((r.score / scoreCap(server)) * 100, 100));
                                                    const cname = charNames.get(r.characterId) || CHAR_NAMES[r.characterId] || `ID ${r.characterId}`;
                                                    return (
                                                        <div key={r.characterId} className="grid grid-cols-[170px_70px_130px_minmax(240px,1fr)_90px_110px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
                                                            <div className="flex items-center gap-2 min-w-0"><div className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200"><Image src={getCharacterIconUrl(r.characterId)} alt={cname} fill className="object-cover" unoptimized /></div><span className="text-sm font-semibold text-slate-700 truncate">{cname}</span></div>
                                                            <div className="text-sm font-bold text-slate-700 text-center">{r.rank}</div>
                                                            <div className="text-sm font-bold text-slate-700 text-center">{r.score.toLocaleString()}</div>
                                                            <div className="h-4 rounded-full bg-slate-500/75 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${prog}%`, backgroundColor: themeColor }} /></div>
                                                            <div className="text-sm font-bold text-slate-700 text-center">{r.remainJewel}</div>
                                                            <div className="text-sm font-bold text-slate-700 text-center">{r.remainFragment}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
