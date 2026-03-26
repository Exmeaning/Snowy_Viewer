"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CHARACTER_NAMES, UNIT_DATA, UNIT_ICON_FILES } from "@/types/types";
import { getCharacterIconUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";
import Modal from "@/components/common/Modal";
import type { UserBond, UserCharacter } from "@/lib/account";

interface BondsRankTableProps {
    userBonds: UserBond[];
    userCharacters: UserCharacter[];
}

interface BondRow {
    key: string;
    c1: number;
    c2: number;
    rank: number | null;
    exp: number | null;
}

const MAX_BOND_LEVEL = 75;
const DEFAULT_TOPK = 5;

function extractPairFromGroupId(groupId: number): { c1: number; c2: number } {
    return {
        c1: Math.floor(groupId / 100) % 100,
        c2: groupId % 100,
    };
}

function normalizePair(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function pairKey(a: number, b: number): string {
    return `${a}-${b}`;
}

export default function BondsRankTable({ userBonds, userCharacters }: BondsRankTableProps) {
    const { themeColor } = useTheme();
    const [showDetailModal, setShowDetailModal] = useState(false);
    // Filters are inside the modal only
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

    const characterRankMap = useMemo(() => {
        const map = new Map<number, number>();
        userCharacters.forEach((item) => map.set(item.characterId, item.characterRank));
        return map;
    }, [userCharacters]);

    const bondsMap = useMemo(() => {
        const map = new Map<string, UserBond>();
        userBonds.forEach((item) => {
            const { c1, c2 } = extractPairFromGroupId(item.bondsGroupId);
            map.set(normalizePair(c1, c2), item);
        });
        return map;
    }, [userBonds]);

    const displayedCharacters = useMemo(() => {
        if (!selectedUnitId) return [];
        const unit = UNIT_DATA.find((u) => u.id === selectedUnitId);
        return unit ? unit.charIds : [];
    }, [selectedUnitId]);

    // All rows sorted by rank (for modal and top-k)
    const allSortedRows = useMemo((): BondRow[] => {
        return Array.from(bondsMap.entries())
            .map(([pair, bond]) => {
                const [x, y] = pair.split("-").map(Number);
                const xr = characterRankMap.get(x) || 0;
                const yr = characterRankMap.get(y) || 0;
                const c1 = xr >= yr ? x : y;
                const c2 = xr >= yr ? y : x;
                return { key: pairKey(c1, c2), c1, c2, rank: bond.rank, exp: bond.exp } satisfies BondRow;
            })
            .sort((a, b) => {
                const rankDiff = (b.rank || 0) - (a.rank || 0);
                if (rankDiff !== 0) return rankDiff;
                return (b.exp || 0) - (a.exp || 0);
            });
    }, [bondsMap, characterRankMap]);

    // Top K for inline display
    const topRows = useMemo(() => allSortedRows.slice(0, DEFAULT_TOPK), [allSortedRows]);

    // Filtered rows for modal
    const modalRows = useMemo((): BondRow[] => {
        if (selectedCharacterId !== null) {
            const filtered: BondRow[] = [];
            for (let other = 1; other <= 26; other += 1) {
                if (other === selectedCharacterId) continue;
                const bond = bondsMap.get(normalizePair(selectedCharacterId, other));
                filtered.push({
                    key: pairKey(selectedCharacterId, other),
                    c1: selectedCharacterId,
                    c2: other,
                    rank: bond?.rank ?? null,
                    exp: bond?.exp ?? null,
                });
            }
            return filtered;
        }
        return allSortedRows;
    }, [selectedCharacterId, bondsMap, allSortedRows]);

    const handleUnitClick = (unitId: string) => {
        if (selectedUnitId === unitId) {
            setSelectedUnitId(null);
            setSelectedCharacterId(null);
        } else {
            setSelectedUnitId(unitId);
            setSelectedCharacterId(null);
        }
    };

    const handleOpenModal = () => {
        setSelectedUnitId(null);
        setSelectedCharacterId(null);
        setShowDetailModal(true);
    };

    const renderRow = (row: BondRow) => {
        const c1Rank = characterRankMap.get(row.c1) || 0;
        const c2Rank = characterRankMap.get(row.c2) || 0;
        const progress = row.rank ? Math.max(0, Math.min((row.rank / MAX_BOND_LEVEL) * 100, 100)) : 0;
        const expText = row.rank === null ? "-" : row.rank >= MAX_BOND_LEVEL ? "MAX" : String(row.exp || 0);

        return (
            <div key={row.key} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex -space-x-2">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white bg-slate-100">
                            <Image src={getCharacterIconUrl(row.c1)} alt={CHARACTER_NAMES[row.c1]} fill className="object-cover" unoptimized />
                        </div>
                        <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white bg-slate-100">
                            <Image src={getCharacterIconUrl(row.c2)} alt={CHARACTER_NAMES[row.c2]} fill className="object-cover" unoptimized />
                        </div>
                    </div>
                    <div className="text-xs font-bold text-slate-700">Lv {c1Rank} &amp; {c2Rank}</div>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">羁绊等级</span>
                    <span className="font-bold text-slate-700">{row.rank ?? "-"}</span>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>进度</span>
                        <span className="font-bold text-slate-700">经验 {expText}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-500/75 overflow-hidden relative">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: themeColor }} />
                    </div>
                </div>
            </div>
        );
    };

    const renderDesktopRow = (row: BondRow) => {
        const c1Rank = characterRankMap.get(row.c1) || 0;
        const c2Rank = characterRankMap.get(row.c2) || 0;
        const progress = row.rank ? Math.max(0, Math.min((row.rank / MAX_BOND_LEVEL) * 100, 100)) : 0;
        const expText = row.rank === null ? "-" : row.rank >= MAX_BOND_LEVEL ? "MAX" : String(row.exp || 0);

        return (
            <div key={row.key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-2 py-2">
                <div className="w-[92px] shrink-0 flex items-center gap-3 min-w-0">
                    <div className="flex -space-x-2">
                        <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white bg-slate-100">
                            <Image src={getCharacterIconUrl(row.c1)} alt={CHARACTER_NAMES[row.c1]} fill className="object-cover" unoptimized />
                        </div>
                        <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white bg-slate-100">
                            <Image src={getCharacterIconUrl(row.c2)} alt={CHARACTER_NAMES[row.c2]} fill className="object-cover" unoptimized />
                        </div>
                    </div>
                </div>
                <div className="w-20 shrink-0 text-sm font-bold text-slate-700 text-center">{c1Rank} &amp; {c2Rank}</div>
                <div className="w-[72px] shrink-0 text-sm font-bold text-slate-700 text-center">{row.rank ?? "-"}</div>
                <div className="flex-1 min-w-0">
                    <div className="h-4 rounded-full bg-slate-500/75 overflow-hidden relative">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: themeColor }} />
                    </div>
                </div>
                <div className="w-[72px] shrink-0 text-sm font-bold text-slate-700 text-center">{expText}</div>
            </div>
        );
    };

    return (
        <div id="profile-bonds-rank" className="scroll-mt-20 glass-card p-5 sm:p-6 rounded-2xl h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-primary-text flex items-center gap-2">
                    <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: themeColor }}></span>
                    羁绊等级
                </h2>
                {bondsMap.size > DEFAULT_TOPK && (
                    <button
                        onClick={handleOpenModal}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-miku/40 hover:text-miku transition-colors"
                    >
                        查看详情
                    </button>
                )}
            </div>

            {/* Inline top-k rows */}
            <div className="sm:hidden space-y-2">
                {topRows.map(renderRow)}
                {topRows.length === 0 && <div className="text-center py-8 text-sm text-slate-400">暂无羁绊数据</div>}
            </div>

            <div className="hidden sm:block space-y-2">
                <div className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-slate-600">
                    <div className="w-[92px] shrink-0 text-left">角色</div>
                    <div className="w-20 shrink-0 text-center">角色等级</div>
                    <div className="w-[72px] shrink-0 text-center">羁绊等级</div>
                    <div className="flex-1 min-w-0 text-center">进度</div>
                    <div className="w-[72px] shrink-0 text-center">升级经验</div>
                </div>
                {topRows.map(renderDesktopRow)}
                {topRows.length === 0 && <div className="text-center py-8 text-sm text-slate-400">暂无羁绊数据</div>}
            </div>

            <Modal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title="羁绊等级详情"
                size="xl"
            >
                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {UNIT_DATA.map((unit) => {
                                const selected = selectedUnitId === unit.id;
                                return (
                                    <button
                                        key={unit.id}
                                        onClick={() => handleUnitClick(unit.id)}
                                        className={`p-1.5 rounded-xl transition-all ${selected
                                            ? "ring-2 ring-miku shadow-lg bg-white"
                                            : "hover:bg-white border border-transparent bg-slate-100"
                                            }`}
                                        title={unit.name}
                                    >
                                        <div className="w-8 h-8 relative">
                                            <Image src={`/data/icon/${UNIT_ICON_FILES[unit.id]}`} alt={unit.name} fill className="object-contain" unoptimized />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {displayedCharacters.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {displayedCharacters.map((characterId) => {
                                    const selected = selectedCharacterId === characterId;
                                    return (
                                        <button
                                            key={characterId}
                                            onClick={() => setSelectedCharacterId(selected ? null : characterId)}
                                            className={`relative transition-all ${selected
                                                ? "ring-2 ring-miku scale-110 z-10 rounded-full"
                                                : "ring-2 ring-transparent hover:ring-slate-200 rounded-full opacity-85 hover:opacity-100"
                                                }`}
                                            title={CHARACTER_NAMES[characterId]}
                                        >
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                                                <Image src={getCharacterIconUrl(characterId)} alt={CHARACTER_NAMES[characterId]} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="sm:hidden space-y-2">
                        {modalRows.map(renderRow)}
                        {modalRows.length === 0 && <div className="text-center py-8 text-sm text-slate-400">暂无羁绊数据</div>}
                    </div>

                    <div className="hidden sm:block overflow-x-auto">
                        <div className="min-w-[760px] space-y-2">
                            <div className="flex items-center gap-2 px-2 py-2 text-sm font-bold text-slate-600">
                                <div className="w-[92px] shrink-0 text-left">角色</div>
                                <div className="w-20 shrink-0 text-center">角色等级</div>
                                <div className="w-[72px] shrink-0 text-center">羁绊等级</div>
                                <div className="flex-1 min-w-0 text-center">进度</div>
                                <div className="w-[72px] shrink-0 text-center">升级经验</div>
                            </div>
                            {modalRows.map(renderDesktopRow)}
                            {modalRows.length === 0 && <div className="text-center py-8 text-sm text-slate-400">暂无羁绊数据</div>}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
