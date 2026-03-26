"use client";

import React, { useState } from "react";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";
import SekaiCardThumbnail from "@/components/cards/SekaiCardThumbnail";
import Modal from "@/components/common/Modal";
import ImagePreviewModal from "@/components/common/ImagePreviewModal";
import BaseFilters, { FilterSection, FilterButton, FilterToggle } from "@/components/common/BaseFilters";
import { useQuickFilter } from "@/contexts/QuickFilterContext";

export default function DesignSystemPage() {
    const [modalSize, setModalSize] = useState<"sm" | "md" | "lg" | "xl">("md");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // ===== Quick Filter demo state =====
    const [demoSearch, setDemoSearch] = useState("");
    const [demoSortBy, setDemoSortBy] = useState("name");
    const [demoSortOrder, setDemoSortOrder] = useState<"asc" | "desc">("desc");
    const [demoCategory, setDemoCategory] = useState("all");
    const [demoToggle, setDemoToggle] = useState(false);

    const demoTotalCount = 128;
    const demoFilteredCount = demoSearch || demoCategory !== "all" || demoToggle ? 42 : 128;

    const demoSortOptions = [
        { id: "name", label: "名称" },
        { id: "date", label: "日期" },
        { id: "level", label: "等级" },
    ];

    const hasActiveFilters = demoSearch !== "" || demoCategory !== "all" || demoToggle || demoSortBy !== "name";

    const resetDemoFilters = () => {
        setDemoSearch("");
        setDemoSortBy("name");
        setDemoSortOrder("desc");
        setDemoCategory("all");
        setDemoToggle(false);
    };

    // Register quick filter content for this page
    const quickFilterContent = (
        <BaseFilters
            title="快捷筛选器演示"
            filteredCount={demoFilteredCount}
            totalCount={demoTotalCount}
            countUnit="项"
            searchQuery={demoSearch}
            onSearchChange={setDemoSearch}
            searchPlaceholder="搜索示例..."
            sortOptions={demoSortOptions}
            sortBy={demoSortBy}
            sortOrder={demoSortOrder}
            onSortChange={(sortBy, sortOrder) => { setDemoSortBy(sortBy); setDemoSortOrder(sortOrder); }}
            hasActiveFilters={hasActiveFilters}
            onReset={resetDemoFilters}
        >
            <FilterSection label="分类">
                <div className="grid grid-cols-3 gap-2">
                    {["all", "typeA", "typeB"].map(cat => (
                        <FilterButton
                            key={cat}
                            selected={demoCategory === cat}
                            onClick={() => setDemoCategory(cat)}
                        >
                            {cat === "all" ? "全部" : cat === "typeA" ? "类型 A" : "类型 B"}
                        </FilterButton>
                    ))}
                </div>
            </FilterSection>
            <FilterToggle
                selected={demoToggle}
                onClick={() => setDemoToggle(prev => !prev)}
                label="仅显示已完成"
            />
        </BaseFilters>
    );

    useQuickFilter("快捷筛选器演示", quickFilterContent, [
        demoSearch, demoSortBy, demoSortOrder, demoCategory, demoToggle,
    ]);


    const openModal = (size: "sm" | "md" | "lg" | "xl") => {
        setModalSize(size);
        setIsModalOpen(true);
    };

    return (
        <MainLayout>
            <div className="container mx-auto px-6 py-12 max-w-6xl">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-miku to-luka bg-clip-text text-transparent mb-4">
                        Design System & Component Library
                    </h1>
                    <p className="text-slate-500 text-lg">
                        Reference guide for UI elements, colors, and typography used in Snowy Viewer.
                    </p>
                </div>

                {/* Colors Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-primary-text mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-miku rounded-full"></span>
                        Color Palette
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Brand Colors */}
                        <ColorCard name="Miku Green" variable="--color-miku" className="bg-miku text-white" hex="Dynamic (User Theme)" />
                        <ColorCard name="Miku Dark" variable="--color-miku-dark" className="bg-miku-dark text-white" hex="Dynamic (Dark Variant)" />
                        <ColorCard name="Luka Pink" variable="--color-luka" className="bg-luka text-white" hex="#ff6699" />

                        {/* Text Colors */}
                        <ColorCard name="Primary Text" variable="--color-primary-text" className="bg-primary-text text-white" hex="#334455" />
                        <ColorCard name="Slate 500" className="bg-slate-500 text-white" hex="#64748b" />
                        <ColorCard name="Slate 400" className="bg-slate-400 text-white" hex="#94a3b8" />

                        {/* Backgrounds */}
                        <div className="glass-card p-4 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group">
                            <span className="font-bold relative z-10">Glass Card</span>
                            <div className="text-xs opacity-70 relative z-10">.glass-card</div>
                            <div className="absolute inset-0 bg-white/20"></div>
                        </div>

                        <div className="rounded-xl p-4 border border-slate-200 bg-slate-50 h-32 flex flex-col justify-between">
                            <span className="font-bold text-slate-700">Surface / Slate 50</span>
                            <div className="text-xs text-slate-500">bg-slate-50</div>
                        </div>
                    </div>
                </section>

                {/* Typography Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-primary-text mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-luka rounded-full"></span>
                        Typography
                    </h2>

                    <div className="glass-card p-8 rounded-2xl space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-200 pb-8">
                            <div className="text-sm text-slate-400 font-mono">H1 / 4xl / Bold</div>
                            <div className="md:col-span-2">
                                <h1 className="text-4xl font-bold text-primary-text">The quick brown fox jumps over the lazy dog</h1>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-200 pb-8">
                            <div className="text-sm text-slate-400 font-mono">H2 / 2xl / Bold</div>
                            <div className="md:col-span-2">
                                <h2 className="text-2xl font-bold text-primary-text">The quick brown fox jumps over the lazy dog</h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-200 pb-8">
                            <div className="text-sm text-slate-400 font-mono">H3 / xl / Bold</div>
                            <div className="md:col-span-2">
                                <h3 className="text-xl font-bold text-primary-text">The quick brown fox jumps over the lazy dog</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-200 pb-8">
                            <div className="text-sm text-slate-400 font-mono">Body / Base / Normal</div>
                            <div className="md:col-span-2">
                                <p className="text-base text-primary-text">
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                            <div className="text-sm text-slate-400 font-mono">Small / sm / Slate-500</div>
                            <div className="md:col-span-2">
                                <p className="text-sm text-slate-500">
                                    Used for captions, timestamps, and secondary information.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Components Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-primary-text mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-amber-400 rounded-full"></span>
                        Components
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Buttons */}
                        <div className="glass-card p-6 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Buttons</h3>
                            <div className="flex flex-wrap gap-4 items-center">
                                {/* Primary */}
                                <button className="px-6 py-2 bg-miku text-white rounded-lg font-bold shadow-lg shadow-miku/20 hover:opacity-90 active:scale-95 transition-all">
                                    Primary Button
                                </button>

                                {/* Secondary */}
                                <button className="px-6 py-2 border-2 border-miku text-miku rounded-lg font-bold hover:bg-miku hover:text-white active:scale-95 transition-all">
                                    Secondary
                                </button>

                                {/* Ghost/Nav */}
                                <button className="px-4 py-2 text-slate-500 font-bold hover:text-miku hover:bg-slate-50 rounded-lg transition-colors">
                                    Ghost / Nav
                                </button>

                                {/* Icon Layout */}
                                <button className="p-2 text-slate-400 hover:text-miku hover:bg-slate-50 rounded-lg transition-colors">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="glass-card p-6 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Inputs</h3>
                            <div className="space-y-4 max-w-sm">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Standard Input</label>
                                    <input
                                        type="text"
                                        placeholder="Type something..."
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-miku/20 focus:border-miku transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Input with Error</label>
                                    <input
                                        type="text"
                                        defaultValue="Invalid input"
                                        className="w-full px-4 py-2 rounded-lg border border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200 text-red-600"
                                    />
                                    <p className="mt-1 text-xs text-red-500">Please enter a valid value</p>
                                </div>
                            </div>
                        </div>

                        {/* Badges & Tags */}
                        <div className="glass-card p-6 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Badges & Tags</h3>
                            <div className="flex flex-wrap gap-3">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-miku text-white">
                                    New Feature
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-miku/10 text-miku border border-miku/20">
                                    Version 1.0
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-white">
                                    BETA
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                                    Draft
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold border border-slate-200 text-slate-500">
                                    Outline
                                </span>
                            </div>
                        </div>

                        {/* Loaders */}
                        <div className="glass-card p-6 rounded-2xl flex flex-col justify-center items-center gap-4">
                            <h3 className="text-lg font-bold mb-2 text-slate-600 self-start">Loaders</h3>
                            <div className="flex items-center gap-8">
                                <div className="loading-spinner"></div>
                                <div className="w-8 h-8 border-2 border-miku/30 border-t-miku rounded-full animate-spin"></div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="glass-card p-6 rounded-2xl md:col-span-2">
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Tabs</h3>
                            <div className="flex gap-2">
                                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    Active Tab
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                    Inactive Tab
                                </button>
                            </div>
                        </div>

                        {/* Dropdowns */}
                        <div className="glass-card p-6 rounded-2xl md:col-span-2">
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Dropdowns</h3>
                            <div className="relative inline-block text-left w-64">
                                <div className="bg-white rounded-lg shadow-lg border border-slate-100 py-2">
                                    <a href="#" className="block px-4 py-2 text-sm font-medium transition-colors text-miku bg-miku/5">
                                        Active Option
                                    </a>
                                    <a href="#" className="block px-4 py-2 text-sm font-medium transition-colors text-slate-600 hover:text-miku hover:bg-slate-50">
                                        Hover Option
                                    </a>
                                    <a href="#" className="block px-4 py-2 text-sm font-medium transition-colors text-slate-600 hover:text-miku hover:bg-slate-50">
                                        Standard Option
                                    </a>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Complex Components Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-primary-text mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-purple-400 rounded-full"></span>
                        Complex Components
                    </h2>

                    <div className="space-y-12">
                        {/* Page Title */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Page Title (Overview Style)</h3>
                            <div className="border border-dashed border-slate-300 p-8 rounded-2xl bg-white/50">
                                <div className="text-center">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                                        <span className="text-miku text-xs font-bold tracking-widest uppercase">PAGE CATEGORY</span>
                                    </div>
                                    <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                                        Page <span className="text-miku">Title</span>
                                    </h1>
                                    <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                                        Page subtitle or description text goes here.
                                    </p>
                                </div>
                            </div>
                        </div>



                        {/* Section Card (Related Events) */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Section Card (e.g., Related Event)</h3>
                            <div className="max-w-md bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Section Title
                                    </h2>
                                </div>
                                <div className="p-0">
                                    <div className="block group cursor-pointer">
                                        <div className="relative aspect-[2/1] w-full bg-slate-200">
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                                Banner Image Placeholder
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                                            <div className="absolute bottom-0 left-0 w-full p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono bg-white/20 text-white px-2 py-0.5 rounded backdrop-blur-sm">
                                                        Tag #123
                                                    </span>
                                                </div>
                                                <h3 className="text-white font-bold text-lg leading-tight truncate">
                                                    Card Title / Event Name
                                                    <span className="text-sm font-medium text-white/90 truncate block mt-0.5">
                                                        Subtitle / Translation
                                                    </span>
                                                </h3>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </section>

                {/* Sekai Card Thumbnail Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-primary-text mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-pink-400 rounded-full"></span>
                        Sekai Card Thumbnail
                    </h2>

                    <div className="glass-card p-8 rounded-2xl">
                        <p className="text-slate-500 mb-6">
                            New SVG-based component that reproduces the official in-game thumbnail layering logic.
                        </p>

                        <div className="flex flex-wrap gap-8">
                            {/* Example 1: 4★ Normal */}
                            <div className="flex flex-col items-center gap-2">
                                <SekaiCardThumbnail
                                    card={{
                                        id: 1,
                                        seq: 1,
                                        characterId: 21, // Miku
                                        cardRarityType: "rarity_4",
                                        specialTrainingPower1BonusFixed: 0,
                                        specialTrainingPower2BonusFixed: 0,
                                        specialTrainingPower3BonusFixed: 0,
                                        attr: "cool",
                                        supportUnit: "none",
                                        skillId: 1,
                                        cardSkillName: "Skill",
                                        prefix: "Always Singing",
                                        assetbundleName: "res021_no018", // Example: 4* Miku
                                        gachaPhrase: "Phrase",
                                        archiveDisplayType: "normal",
                                        archivePublishedAt: 0,
                                        cardParameters: { param1: [], param2: [], param3: [] },
                                        specialTrainingCosts: [],
                                        masterLessonAchieveResources: [],
                                        releaseAt: 0,
                                        cardSupplyId: 0,
                                        cardSupplyType: "normal",
                                    }}
                                    width={128}
                                />
                                <span className="text-xs text-slate-500 font-mono">4★ Normal</span>
                            </div>

                            {/* Example 2: 4★ Trained + Mastery 5 */}
                            <div className="flex flex-col items-center gap-2">
                                <SekaiCardThumbnail
                                    card={{
                                        id: 2,
                                        seq: 2,
                                        characterId: 21,
                                        cardRarityType: "rarity_4",
                                        specialTrainingPower1BonusFixed: 0,
                                        specialTrainingPower2BonusFixed: 0,
                                        specialTrainingPower3BonusFixed: 0,
                                        attr: "cute",
                                        supportUnit: "none",
                                        skillId: 1,
                                        cardSkillName: "Skill",
                                        prefix: "Trained Miku",
                                        assetbundleName: "res021_no018",
                                        gachaPhrase: "Phrase",
                                        archiveDisplayType: "normal",
                                        archivePublishedAt: 0,
                                        cardParameters: { param1: [], param2: [], param3: [] },
                                        specialTrainingCosts: [],
                                        masterLessonAchieveResources: [],
                                        releaseAt: 0,
                                        cardSupplyId: 0,
                                        cardSupplyType: "normal",
                                    }}
                                    trained={true}
                                    mastery={5}
                                    width={128}
                                />
                                <span className="text-xs text-slate-500 font-mono">4★ Trained + M5</span>
                            </div>

                            {/* Example 3: Birthday */}
                            <div className="flex flex-col items-center gap-2">
                                <SekaiCardThumbnail
                                    card={{
                                        id: 3,
                                        seq: 3,
                                        characterId: 21,
                                        cardRarityType: "rarity_birthday",
                                        specialTrainingPower1BonusFixed: 0,
                                        specialTrainingPower2BonusFixed: 0,
                                        specialTrainingPower3BonusFixed: 0,
                                        attr: "happy",
                                        supportUnit: "none",
                                        skillId: 1,
                                        cardSkillName: "Skill",
                                        prefix: "Happy Birthday",
                                        assetbundleName: "birthday_miku_2023", // Hypothetical
                                        gachaPhrase: "Phrase",
                                        archiveDisplayType: "normal",
                                        archivePublishedAt: 0,
                                        cardParameters: { param1: [], param2: [], param3: [] },
                                        specialTrainingCosts: [],
                                        masterLessonAchieveResources: [],
                                        releaseAt: 0,
                                        cardSupplyId: 0,
                                        cardSupplyType: "normal",
                                    }}
                                    width={128}
                                />
                                <span className="text-xs text-slate-500 font-mono">Birthday</span>
                            </div>

                            {/* Example 4: 2★ Normal */}
                            <div className="flex flex-col items-center gap-2">
                                <SekaiCardThumbnail
                                    card={{
                                        id: 4,
                                        seq: 4,
                                        characterId: 26, // Kaito
                                        cardRarityType: "rarity_2",
                                        specialTrainingPower1BonusFixed: 0,
                                        specialTrainingPower2BonusFixed: 0,
                                        specialTrainingPower3BonusFixed: 0,
                                        attr: "mysterious",
                                        supportUnit: "none",
                                        skillId: 1,
                                        cardSkillName: "Skill",
                                        prefix: "KAITO",
                                        assetbundleName: "res026_no002",
                                        gachaPhrase: "Phrase",
                                        archiveDisplayType: "normal",
                                        archivePublishedAt: 0,
                                        cardParameters: { param1: [], param2: [], param3: [] },
                                        specialTrainingCosts: [],
                                        masterLessonAchieveResources: [],
                                        releaseAt: 0,
                                        cardSupplyId: 0,
                                        cardSupplyType: "normal",
                                    }}
                                    width={128}
                                />
                                <span className="text-xs text-slate-500 font-mono">2★ Normal</span>
                            </div>
                        </div>

                        {/* Example 5: Scaled Sizes */}
                        <div className="w-full mt-6 border-t border-slate-100 pt-6">
                            <h4 className="text-sm font-bold text-slate-500 mb-4">Scalability (Different Sizes)</h4>
                            <div className="flex items-end gap-4">
                                {/* 48px */}
                                <div className="flex flex-col items-center gap-1">
                                    <SekaiCardThumbnail
                                        card={{
                                            id: 5,
                                            seq: 5,
                                            characterId: 1, // Ichika
                                            cardRarityType: "rarity_3",
                                            specialTrainingPower1BonusFixed: 0,
                                            specialTrainingPower2BonusFixed: 0,
                                            specialTrainingPower3BonusFixed: 0,
                                            attr: "pure",
                                            supportUnit: "none",
                                            skillId: 1,
                                            cardSkillName: "Skill",
                                            prefix: "Small",
                                            assetbundleName: "res001_no007",
                                            gachaPhrase: "Phrase",
                                            archiveDisplayType: "normal",
                                            archivePublishedAt: 0,
                                            cardParameters: { param1: [], param2: [], param3: [] },
                                            specialTrainingCosts: [],
                                            masterLessonAchieveResources: [],
                                            releaseAt: 0,
                                            cardSupplyId: 0,
                                            cardSupplyType: "normal",
                                        }}
                                        width={48}
                                    />
                                    <span className="text-[10px] text-slate-400 font-mono">48px</span>
                                </div>

                                {/* 64px */}
                                <div className="flex flex-col items-center gap-1">
                                    <SekaiCardThumbnail
                                        card={{
                                            id: 5,
                                            seq: 5,
                                            characterId: 1,
                                            cardRarityType: "rarity_3",
                                            specialTrainingPower1BonusFixed: 0,
                                            specialTrainingPower2BonusFixed: 0,
                                            specialTrainingPower3BonusFixed: 0,
                                            attr: "pure",
                                            supportUnit: "none",
                                            skillId: 1,
                                            cardSkillName: "Skill",
                                            prefix: "Medium",
                                            assetbundleName: "res001_no007",
                                            gachaPhrase: "Phrase",
                                            archiveDisplayType: "normal",
                                            archivePublishedAt: 0,
                                            cardParameters: { param1: [], param2: [], param3: [] },
                                            specialTrainingCosts: [],
                                            masterLessonAchieveResources: [],
                                            releaseAt: 0,
                                            cardSupplyId: 0,
                                            cardSupplyType: "normal",
                                        }}
                                        width={64}
                                    />
                                    <span className="text-[10px] text-slate-400 font-mono">64px</span>
                                </div>

                                {/* 96px */}
                                <div className="flex flex-col items-center gap-1">
                                    <SekaiCardThumbnail
                                        card={{
                                            id: 5,
                                            seq: 5,
                                            characterId: 1,
                                            cardRarityType: "rarity_3",
                                            specialTrainingPower1BonusFixed: 0,
                                            specialTrainingPower2BonusFixed: 0,
                                            specialTrainingPower3BonusFixed: 0,
                                            attr: "pure",
                                            supportUnit: "none",
                                            skillId: 1,
                                            cardSkillName: "Skill",
                                            prefix: "Large",
                                            assetbundleName: "res001_no007",
                                            gachaPhrase: "Phrase",
                                            archiveDisplayType: "normal",
                                            archivePublishedAt: 0,
                                            cardParameters: { param1: [], param2: [], param3: [] },
                                            specialTrainingCosts: [],
                                            masterLessonAchieveResources: [],
                                            releaseAt: 0,
                                            cardSupplyId: 0,
                                            cardSupplyType: "normal",
                                        }}
                                        width={96}
                                    />
                                    <span className="text-[10px] text-slate-400 font-mono">96px</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Modal / Dialog Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-primary-text mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-sky-400 rounded-full"></span>
                        Modal / Dialog
                    </h2>

                    <div className="glass-card p-8 rounded-2xl">
                        <p className="text-slate-500 mb-6">
                            Generic modal component with theme-colored header, backdrop blur, and smooth framer-motion animations.
                            Rendered via <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-600">createPortal</code> to
                            ensure viewport-centered positioning regardless of sidebar state.
                        </p>

                        <div className="flex flex-wrap gap-4 items-center">
                            <button
                                onClick={() => openModal("sm")}
                                className="px-5 py-2 border-2 border-miku text-miku rounded-lg font-bold hover:bg-miku hover:text-white active:scale-95 transition-all text-sm"
                            >
                                Small
                            </button>
                            <button
                                onClick={() => openModal("md")}
                                className="px-6 py-2 bg-miku text-white rounded-lg font-bold shadow-lg shadow-miku/20 hover:opacity-90 active:scale-95 transition-all text-sm"
                            >
                                Medium (Default)
                            </button>
                            <button
                                onClick={() => openModal("lg")}
                                className="px-5 py-2 border-2 border-miku text-miku rounded-lg font-bold hover:bg-miku hover:text-white active:scale-95 transition-all text-sm"
                            >
                                Large
                            </button>
                            <button
                                onClick={() => openModal("xl")}
                                className="px-5 py-2 border-2 border-miku text-miku rounded-lg font-bold hover:bg-miku hover:text-white active:scale-95 transition-all text-sm"
                            >
                                Extra Large
                            </button>
                            <button
                                onClick={() => setIsImageModalOpen(true)}
                                className="px-5 py-2 border-2 border-emerald-500 text-emerald-600 rounded-lg font-bold hover:bg-emerald-500 hover:text-white active:scale-95 transition-all text-sm"
                            >
                                Image Preview
                            </button>
                        </div>

                        <div className="mt-4 text-xs text-slate-400 font-mono">
                            {`<Modal isOpen={…} onClose={…} title="弹出窗口标题" size="sm | md | lg | xl">{children}</Modal>`}
                        </div>
                        <div className="mt-2 text-xs text-slate-400 font-mono">
                            {`<ImagePreviewModal isOpen={…} onClose={…} title="图片预览" imageUrl="..." fileName="example.png" />`}
                        </div>
                    </div>

                    <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="弹出窗口示例" size={modalSize}>
                        <div className="space-y-4">
                            <p className="text-slate-600">
                                这是一个通用弹出窗口组件的演示。它会始终在视口中央显示，不受侧边栏和顶栏的影响。
                            </p>
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <h3 className="text-sm font-bold text-slate-700 mb-2">特性</h3>
                                <ul className="text-sm text-slate-500 space-y-1.5 list-disc list-inside">
                                    <li>使用 createPortal 渲染，避免 z-index 层级问题</li>
                                    <li>framer-motion 入场/出场动画</li>
                                    <li>ESC 键关闭 / 点击遮罩关闭</li>
                                    <li>打开时禁用背景滚动</li>
                                    <li>支持 sm / md / lg / xl 四种尺寸</li>
                                    <li>应用主题色（miku）作为标题栏装饰</li>
                                </ul>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-miku/10 text-miku border border-miku/20">
                                    当前尺寸: {modalSize}
                                </span>
                            </div>
                        </div>
                    </Modal>

                    <ImagePreviewModal
                        isOpen={isImageModalOpen}
                        onClose={() => setIsImageModalOpen(false)}
                        title="图片预览弹窗示例"
                        imageUrl="/sticker-maker/img/ichika/ichika1.png"
                        alt="Image Preview Demo"
                        fileName="design_system_image_preview.png"
                    />
                </section>

                {/* Quick Filter Section */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-primary-text mb-6 flex items-center gap-2">
                        <span className="w-1.5 h-8 bg-emerald-400 rounded-full"></span>
                        Quick Filter (快捷筛选器)
                    </h2>

                    <div className="glass-card p-8 rounded-2xl">
                        <p className="text-slate-500 mb-6">
                            全局通用的快捷筛选器组件。页面通过{" "}
                            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-600">useQuickFilter()</code>{" "}
                            注册筛选内容后，页面右下角会出现一个漏斗图标的浮动按钮（位于"回到顶部"按钮上方），
                            点击后弹出 Modal 展示筛选面板。
                        </p>

                        <div className="flex flex-wrap gap-4 items-center mb-6">
                            <div className="flex items-center gap-3 px-4 py-2 bg-miku/5 border border-miku/20 rounded-xl">
                                <svg className="w-5 h-5 text-miku" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                <span className="text-sm font-bold text-miku">← 请查看右下角的浮动筛选按钮</span>
                            </div>

                            {hasActiveFilters && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-white animate-pulse">
                                    筛选器已激活
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Inline preview */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">内嵌预览</h4>
                                <div className="max-w-sm">
                                    {quickFilterContent}
                                </div>
                            </div>

                            {/* Usage guide */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">使用方式</h4>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <ul className="text-sm text-slate-500 space-y-2 list-disc list-inside">
                                        <li>页面组件中调用 <code className="px-1 py-0.5 bg-white rounded text-xs font-mono">useQuickFilter(title, content, deps)</code></li>
                                        <li>筛选器内容自动注册到全局 Context</li>
                                        <li>右下角浮动按钮仅在有注册内容时显示</li>
                                        <li>组件卸载时自动取消注册</li>
                                        <li>BaseFilters 的所有功能均可在弹窗内使用</li>
                                    </ul>
                                </div>

                                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">当前筛选状态</h5>
                                    <div className="text-xs text-slate-500 font-mono space-y-1">
                                        <div>search: &quot;{demoSearch || "(空)"}&quot;</div>
                                        <div>sortBy: &quot;{demoSortBy}&quot; / order: &quot;{demoSortOrder}&quot;</div>
                                        <div>category: &quot;{demoCategory}&quot;</div>
                                        <div>toggle: {demoToggle ? "true" : "false"}</div>
                                        <div>filtered: {demoFilteredCount} / {demoTotalCount}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-xs text-slate-400 font-mono">
                            {`useQuickFilter("筛选标题", <BaseFilters ...>{children}</BaseFilters>, [deps])`}
                        </div>
                    </div>
                </section>
            </div >
        </MainLayout >
    );
}

function ColorCard({ name, variable, className, hex }: { name: string, variable?: string, className: string, hex?: string }) {
    return (
        <div className="flex flex-col h-32 rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className={`flex-grow ${className} flex items-center justify-center`}>
                {hex && <span className="font-mono opacity-80">{hex}</span>}
            </div>
            <div className="p-3 bg-white">
                <div className="font-bold text-sm text-slate-800">{name}</div>
                {variable && <div className="text-xs text-slate-400 font-mono mt-0.5">{variable}</div>}
            </div>
        </div>
    );
}
