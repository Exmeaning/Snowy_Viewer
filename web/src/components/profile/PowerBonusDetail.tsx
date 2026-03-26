"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CHAR_NAMES, CHARACTER_NAMES, UNIT_NAME_MAP, UNIT_DATA, UNIT_FIELD_TO_ID, UNIT_ICON_FILES, type CardAttribute } from "@/types/types";
import { fetchMasterDataForServer } from "@/lib/fetch";
import { getCharacterIconUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import Modal from "@/components/common/Modal";
import type {
    ServerType,
    UserArea,
    UserCharacter,
    UserMysekaiFixtureGameCharacterPerformanceBonus,
    UserMysekaiGate,
} from "@/lib/account";

interface Props {
    server: ServerType;
    userAreas: UserArea[];
    userCharacters: UserCharacter[];
    userMysekaiFixtureGameCharacterPerformanceBonuses: UserMysekaiFixtureGameCharacterPerformanceBonus[];
    userMysekaiGates: UserMysekaiGate[];
}

interface AreaItemLevelMaster {
    areaItemId: number;
    level: number;
    targetUnit: string;
    targetCardAttr: string;
    targetGameCharacterId?: number;
    power1BonusRate: number;
}

interface CharacterRankMaster {
    characterId: number;
    characterRank: number;
    power1BonusRate: number;
}

interface GateLevelMaster {
    mysekaiGateId: number;
    level: number;
    powerBonusRate: number;
}

interface UnitProfileMaster {
    unit: string;
    unitName: string;
}

interface CharaBonus {
    areaItem: number;
    rank: number;
    fixture: number;
    total: number;
}

interface UnitBonus {
    areaItem: number;
    gate: number;
    total: number;
}

interface AttrBonus {
    areaItem: number;
    total: number;
}

const UNIT_ORDER = ["light_sound", "idol", "street", "theme_park", "school_refusal", "piapro"] as const;
const ATTR_ORDER: CardAttribute[] = ["cool", "cute", "happy", "mysterious", "pure"];
const ATTR_ICON_FILES: Record<CardAttribute, string> = {
    cool: "Cool.webp",
    cute: "cute.webp",
    happy: "Happy.webp",
    mysterious: "Mysterious.webp",
    pure: "Pure.webp",
};

const UNIT_ICON: Record<string, string> = Object.fromEntries(
    Object.entries(UNIT_FIELD_TO_ID).map(([field, id]) => [field, "/data/icon/" + UNIT_ICON_FILES[id]])
);

const UNIT_CHAR_IDS: Record<string, number[]> = Object.fromEntries(
    UNIT_DATA.map(u => {
        const field = Object.entries(UNIT_FIELD_TO_ID).find(([, v]) => v === u.id)?.[0];
        return field ? [field, u.charIds] : null;
    }).filter(Boolean) as [string, number[]][]
);

function fmt(v: number): string {
    return `${v.toFixed(1)}%`;
}

export default function PowerBonusDetail({
    server,
    userAreas,
    userCharacters,
    userMysekaiFixtureGameCharacterPerformanceBonuses,
    userMysekaiGates,
}: Props) {
    const { themeColor } = useTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const [areaItemLevels, setAreaItemLevels] = useState<AreaItemLevelMaster[]>([]);
    const [characterRanks, setCharacterRanks] = useState<CharacterRankMaster[]>([]);
    const [gateLevels, setGateLevels] = useState<GateLevelMaster[]>([]);
    const [unitNameMap, setUnitNameMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [a, c, g, unitProfiles] = await Promise.all([
                    fetchMasterDataForServer<AreaItemLevelMaster[]>(server, "areaItemLevels.json"),
                    fetchMasterDataForServer<CharacterRankMaster[]>(server, "characterRanks.json"),
                    fetchMasterDataForServer<GateLevelMaster[]>(server, "mysekaiGateLevels.json"),
                    fetchMasterDataForServer<UnitProfileMaster[]>("cn", "unitProfiles.json"), // Always CN for Chinese names
                ]);
                if (cancelled) return;
                setAreaItemLevels(a);
                setCharacterRanks(c);
                setGateLevels(g);
                const uMap = new Map<string, string>();
                unitProfiles.forEach((u) => {
                    if (u.unit && u.unitName) uMap.set(u.unit, u.unitName);
                });
                setUnitNameMap(uMap);
            } catch {
                if (!cancelled) setError("加成主数据加载失败，请稍后重试");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [server]);

    useEffect(() => {
        setShowDetailModal(false);
    }, [server]);

    const areaItemBonusAtCurrentLv = useMemo(() => {
        const byItem = new Map<number, Map<number, AreaItemLevelMaster>>();
        areaItemLevels.forEach((x) => {
            const m = byItem.get(x.areaItemId) || new Map<number, AreaItemLevelMaster>();
            m.set(x.level, x);
            byItem.set(x.areaItemId, m);
        });
        const rows: AreaItemLevelMaster[] = [];
        userAreas.forEach((area) => {
            area.areaItems.forEach((item) => {
                const row = byItem.get(item.areaItemId)?.get(item.level);
                if (row) rows.push(row);
            });
        });
        return rows;
    }, [areaItemLevels, userAreas]);

    const bonus = useMemo(() => {
        const chara = new Map<number, CharaBonus>();
        for (let i = 1; i <= 26; i += 1) chara.set(i, { areaItem: 0, rank: 0, fixture: 0, total: 0 });

        const unit = new Map<(typeof UNIT_ORDER)[number], UnitBonus>();
        UNIT_ORDER.forEach((u) => unit.set(u, { areaItem: 0, gate: 0, total: 0 }));

        const attr = new Map<CardAttribute, AttrBonus>();
        ATTR_ORDER.forEach((a) => attr.set(a, { areaItem: 0, total: 0 }));

        areaItemBonusAtCurrentLv.forEach((item) => {
            const cid = item.targetGameCharacterId;
            if (typeof cid === "number" && cid >= 1 && cid <= 26) {
                chara.get(cid)!.areaItem += item.power1BonusRate || 0;
            }
            const unitKey = item.targetUnit as (typeof UNIT_ORDER)[number];
            if (UNIT_ORDER.includes(unitKey)) unit.get(unitKey)!.areaItem += item.power1BonusRate || 0;
            const attrKey = item.targetCardAttr as CardAttribute;
            if (ATTR_ORDER.includes(attrKey)) attr.get(attrKey)!.areaItem += item.power1BonusRate || 0;
        });

        const rankByChar = new Map<string, CharacterRankMaster>();
        characterRanks.forEach((r) => rankByChar.set(`${r.characterId}-${r.characterRank}`, r));
        userCharacters.forEach((c) => {
            const r = rankByChar.get(`${c.characterId}-${c.characterRank}`);
            if (!r) return;
            const b = chara.get(c.characterId);
            if (!b) return;
            b.rank += r.power1BonusRate || 0;
        });

        userMysekaiFixtureGameCharacterPerformanceBonuses.forEach((f) => {
            const b = chara.get(f.gameCharacterId);
            if (!b) return;
            b.fixture += (f.totalBonusRate || 0) * 0.1;
        });

        const gateByKey = new Map<string, GateLevelMaster>();
        gateLevels.forEach((g) => gateByKey.set(`${g.mysekaiGateId}-${g.level}`, g));
        let maxGateBonus = 0;
        userMysekaiGates.forEach((g) => {
            const lv = gateByKey.get(`${g.mysekaiGateId}-${g.mysekaiGateLevel}`);
            if (!lv) return;
            const gateBonus = lv.powerBonusRate || 0;
            maxGateBonus = Math.max(maxGateBonus, gateBonus);
            const idx = g.mysekaiGateId - 1;
            if (idx >= 0 && idx < 5) unit.get(UNIT_ORDER[idx])!.gate += gateBonus;
        });
        unit.get("piapro")!.gate += maxGateBonus;

        chara.forEach((b) => { b.total = b.areaItem + b.rank + b.fixture; });
        unit.forEach((b) => { b.total = b.areaItem + b.gate; });
        attr.forEach((b) => { b.total = b.areaItem; });

        return { chara, unit, attr };
    }, [areaItemBonusAtCurrentLv, characterRanks, gateLevels, userCharacters, userMysekaiFixtureGameCharacterPerformanceBonuses, userMysekaiGates]);

    const renderUnitCards = (showBreakdown: boolean) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {UNIT_ORDER.map((unitKey) => {
                const unitBonus = bonus.unit.get(unitKey)!;
                const charIds = UNIT_CHAR_IDS[unitKey];
                const unitLabel = unitNameMap.get(unitKey) || UNIT_NAME_MAP[unitKey] || unitKey;
                const isVirtualSinger = unitKey === "piapro";

                return (
                    <div key={unitKey} className="rounded-xl border border-slate-200 bg-white/70 p-3">
                        <div className="flex flex-col items-center gap-2 mb-3">
                            <div className="relative w-8 h-8 flex-shrink-0">
                                <Image src={UNIT_ICON[unitKey]} alt={unitLabel} fill className="object-contain" unoptimized />
                            </div>
                            <span className="text-xl font-black text-slate-800">{fmt(unitBonus.total)}</span>
                        </div>

                        <div className={`flex justify-center flex-wrap ${isVirtualSinger ? "gap-1.5 sm:gap-2" : "gap-3"}`}>
                            {charIds.map((cid) => {
                                const cb = bonus.chara.get(cid);
                                return (
                                    <div key={cid} className="flex flex-col items-center gap-0.5">
                                        <div className={`relative rounded-full overflow-hidden bg-slate-100 ${isVirtualSinger ? "w-7 h-7" : "w-8 h-8"}`}>
                                            <Image src={getCharacterIconUrl(cid)} alt={CHARACTER_NAMES[cid]} fill className="object-cover" unoptimized />
                                        </div>
                                        <span className={`font-bold text-slate-600 ${isVirtualSinger ? "text-[9px]" : "text-[10px]"}`}>
                                            {cb ? fmt(cb.total) : "-"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {showBreakdown && (
                            <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
                                <div className="text-[11px] text-slate-500">
                                    <span className="font-bold text-slate-600">团体加成</span>
                                    <span className="ml-1.5">{fmt(unitBonus.total)}</span>
                                    <span className="ml-1 text-slate-400">= 区域道具 {fmt(unitBonus.areaItem)} + MySekai门 {fmt(unitBonus.gate)}</span>
                                </div>
                                {charIds.map((cid) => {
                                    const cb = bonus.chara.get(cid);
                                    if (!cb) return null;
                                    const name = CHAR_NAMES[cid] || CHARACTER_NAMES[cid] || `ID ${cid}`;
                                    return (
                                        <div key={cid} className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                            <div className="relative w-4 h-4 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                                                <Image src={getCharacterIconUrl(cid)} alt={name} fill className="object-cover" unoptimized />
                                            </div>
                                            <span className="font-bold text-slate-600">{fmt(cb.total)}</span>
                                            <span className="text-slate-400">= 区域道具 {fmt(cb.areaItem)} + 角色等级 {fmt(cb.rank)} + MySekai玩偶 {fmt(cb.fixture)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    const renderAttrCards = () => (
        <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
            <div className="text-sm font-bold text-slate-700 mb-3">属性加成</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {ATTR_ORDER.map((a) => {
                    const b = bonus.attr.get(a)!;
                    return (
                        <div key={a} className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 flex items-center gap-2">
                            <div className="relative w-6 h-6">
                                <Image src={`/data/icon/${ATTR_ICON_FILES[a]}`} alt={a} fill className="object-contain" unoptimized />
                            </div>
                            <div className="text-sm font-black text-slate-800">{fmt(b.total)}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div id="profile-power-bonus" className="scroll-mt-20 glass-card p-5 sm:p-6 rounded-2xl h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                    <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: themeColor }}></span>
                    加成信息
                </h2>
                {!loading && !error && (
                    <button
                        onClick={() => setShowDetailModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-miku/40 hover:text-miku transition-colors"
                    >
                        查看详情
                    </button>
                )}
            </div>

            {loading && <div className="py-8 text-center text-sm text-slate-500">正在加载加成信息...</div>}
            {!loading && error && <div className="py-8 text-center text-sm text-red-500">{error}</div>}

            {!loading && !error && (
                <div className="space-y-4">
                    {renderUnitCards(false)}
                    {renderAttrCards()}
                </div>
            )}

            {!loading && !error && (
                <Modal
                    isOpen={showDetailModal}
                    onClose={() => setShowDetailModal(false)}
                    title="加成信息详情"
                    size="xl"
                >
                    <div className="space-y-5">
                        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3">
                            <h3 className="text-sm font-bold text-slate-700">团体与角色加成拆解</h3>
                            {renderUnitCards(true)}
                        </section>
                        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3">
                            <h3 className="text-sm font-bold text-slate-700">属性加成</h3>
                            {renderAttrCards()}
                        </section>
                    </div>
                </Modal>
            )}
        </div>
    );
}
