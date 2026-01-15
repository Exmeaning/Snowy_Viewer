"use client";
import React from "react";

interface GachaFiltersProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: "id" | "startAt";
    sortOrder: "asc" | "desc";
    onSortChange: (sortBy: "id" | "startAt", sortOrder: "asc" | "desc") => void;
    totalGachas: number;
    filteredGachas: number;
}

export default function GachaFilters({
    searchQuery,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    totalGachas,
    filteredGachas,
}: GachaFiltersProps) {
    return (
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent flex items-center justify-between">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    筛选
                </h2>
                <span className="text-xs text-slate-500">
                    {filteredGachas} / {totalGachas}
                </span>
            </div>

            <div className="p-5 space-y-5">
                {/* Search */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        搜索
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="输入扭蛋名称..."
                            className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku transition-all"
                        />
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Sort Options */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        排序
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onSortChange("id", sortBy === "id" && sortOrder === "desc" ? "asc" : "desc")}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortBy === "id"
                                ? "bg-miku text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            ID
                            {sortBy === "id" && (
                                <svg className={`w-3 h-3 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={() => onSortChange("startAt", sortBy === "startAt" && sortOrder === "desc" ? "asc" : "desc")}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${sortBy === "startAt"
                                ? "bg-miku text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            开始时间
                            {sortBy === "startAt" && (
                                <svg className={`w-3 h-3 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
