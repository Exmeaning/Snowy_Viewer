"use client";
import React, { useState, useRef, useEffect } from "react";
import { useTheme, CHAR_NAMES, CHAR_COLORS, AssetSourceType } from "@/contexts/ThemeContext";

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Group characters by unit for better organization
const unitGroups = [
    { name: "Leo/need", charIds: [1, 2, 3, 4], color: "#4455DD" },
    { name: "MORE MORE JUMP!", charIds: [5, 6, 7, 8], color: "#88DD44" },
    { name: "Vivid BAD SQUAD", charIds: [9, 10, 11, 12], color: "#EE1166" },
    { name: "Wonderlands×Showtime", charIds: [13, 14, 15, 16], color: "#FF9900" },
    { name: "25時、ナイトコードで。", charIds: [17, 18, 19, 20], color: "#884499" },
    { name: "Virtual Singer", charIds: [21, 22, 23, 24, 25, 26], color: "#33CCBB" },
];

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const { themeCharId, setThemeCharacter, isShowSpoiler, setShowSpoiler, isPowerSaving, setPowerSaving, useTrainedThumbnail, setUseTrainedThumbnail, assetSource, setAssetSource } = useTheme();
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Element;
            // Don't close if clicking the settings button itself or the panel content
            if (isOpen &&
                !target.closest("#settings-panel-content") &&
                !target.closest("#settings-button") &&
                !target.closest("#settings-button-mobile")) {
                onClose();
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    return (
        <div
            id="settings-panel-content"
            ref={panelRef}
            onMouseDown={(e) => e.stopPropagation()}
            className={`fixed sm:absolute top-16 sm:top-full right-2 sm:right-0 mt-0 sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-sm bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden z-[1000] transition-all duration-300 ease-out origin-top-right ${isOpen
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                }`}
        >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-miku/10 to-transparent border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    设置
                </h3>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
                <div className="mb-3">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">主题色</span>
                </div>

                {/* Character Color Grid by Unit */}
                <div className="space-y-3">
                    {unitGroups.map((unit) => (
                        <div key={unit.name}>
                            <div className="text-[10px] text-slate-400 mb-1.5 truncate">{unit.name}</div>
                            <div className="flex flex-wrap gap-1.5">
                                {unit.charIds.map((charId) => {
                                    const isSelected = themeCharId === String(charId);
                                    const color = CHAR_COLORS[String(charId)];
                                    const name = CHAR_NAMES[charId];
                                    return (
                                        <button
                                            key={charId}
                                            onClick={() => {
                                                setThemeCharacter(String(charId));
                                            }}
                                            className={`relative px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${isSelected
                                                ? "ring-2 ring-offset-1 scale-105 shadow-md"
                                                : "hover:scale-105 hover:shadow-sm"
                                                }`}
                                            style={{
                                                backgroundColor: color + "20",
                                                color: color,
                                                "--tw-ring-color": isSelected ? color : undefined,
                                            } as React.CSSProperties}
                                            title={name}
                                        >
                                            {name}
                                            {isSelected && (
                                                <span
                                                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: color }}
                                                />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">内容显示</span>
                    </div>

                    {/* Spoiler Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm text-slate-700">显示剧透内容</span>
                        </div>
                        <button
                            onClick={() => setShowSpoiler(!isShowSpoiler)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isShowSpoiler ? 'bg-orange-500' : 'bg-slate-200'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isShowSpoiler ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        开启后将显示尚未正式发布的卡牌、活动和音乐
                    </p>

                    {/* Trained Thumbnail Toggle */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-slate-700">3★/4★缩略图默认特训后</span>
                        </div>
                        <button
                            onClick={() => setUseTrainedThumbnail(!useTrainedThumbnail)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${useTrainedThumbnail ? 'bg-purple-500' : 'bg-slate-200'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useTrainedThumbnail ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        开启后列表页3★及以上卡牌将默认显示花后缩略图
                    </p>
                </div>

                {/* Power Saving Mode */}
                <div className="border-t border-slate-100 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">性能</span>
                    </div>

                    {/* Power Saving Toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-sm text-slate-700">省电模式</span>
                        </div>
                        <button
                            onClick={() => setPowerSaving(!isPowerSaving)}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${isPowerSaving ? 'bg-green-500' : 'bg-slate-200'}`}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isPowerSaving ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        开启后将禁用动态背景动画，降低性能消耗
                    </p>
                </div>

                {/* Asset Source */}
                <div className="border-t border-slate-100 mt-4 pt-4">
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">assets源</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setAssetSource("uni")}
                            className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${assetSource === "uni"
                                ? "bg-blue-500 text-white shadow-md ring-2 ring-blue-300"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            Uni
                        </button>
                        <button
                            onClick={() => setAssetSource("haruki")}
                            className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${assetSource === "haruki"
                                ? "bg-purple-500 text-white shadow-md ring-2 ring-purple-300"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            Haruki
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                        选择游戏素材的来源服务器，切换后立即生效
                    </p>
                </div>
            </div>
        </div>
    );
}

