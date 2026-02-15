"use client";

import React from "react";
import Image from "next/image";
import MainLayout from "@/components/MainLayout";

export default function DesignSystemPage() {
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

                        {/* Card Item */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-slate-600">Card Item (Event Related Style)</h3>
                            <div className="flex gap-4">
                                {/* Normal Card */}
                                <div className="w-24">
                                    <div className="group block cursor-pointer">
                                        <div className="relative rounded-lg overflow-hidden bg-white ring-1 ring-slate-200 hover:ring-miku hover:shadow-lg transition-all">
                                            {/* Card Image */}
                                            <div className="aspect-square w-full bg-slate-50 p-1 relative">
                                                <div className="w-full h-full relative rounded overflow-hidden bg-slate-200 flex items-center justify-center text-xs text-slate-400">
                                                    Img
                                                </div>

                                                {/* Attribute Badge - Top Left */}
                                                <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 drop-shadow-md z-10">
                                                    <Image
                                                        src="/data/icon/cool.webp"
                                                        alt="cool"
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>

                                                {/* Rarity Badge - Top Right */}
                                                <div className="absolute top-0.5 right-0.5 z-10">
                                                    <div className="bg-black/40 backdrop-blur-[2px] rounded-full px-1 py-0 flex items-center gap-0.5 min-h-[12px]">
                                                        <span className="text-white text-[7px] font-bold leading-none">4</span>
                                                        <div className="w-2 h-2 relative">
                                                            <Image
                                                                src="/data/icon/star.webp"
                                                                alt="Star"
                                                                fill
                                                                className="object-contain"
                                                                unoptimized
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Birthday Card Variant */}
                                <div className="w-24">
                                    <div className="group block cursor-pointer">
                                        <div className="relative rounded-lg overflow-hidden bg-white ring-1 ring-slate-200 hover:ring-miku hover:shadow-lg transition-all">
                                            <div className="aspect-square w-full bg-slate-50 p-1 relative">
                                                <div className="w-full h-full relative rounded overflow-hidden bg-slate-200 flex items-center justify-center text-xs text-slate-400">
                                                    Img
                                                </div>
                                                {/* Attribute Badge */}
                                                <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 drop-shadow-md z-10">
                                                    <Image
                                                        src="/data/icon/cute.webp"
                                                        alt="cute"
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                                {/* Rarity Badge - Birthday */}
                                                <div className="absolute top-0.5 right-0.5 z-10">
                                                    <div className="bg-black/40 backdrop-blur-[2px] rounded-full px-1 py-0 flex items-center gap-0.5 min-h-[12px]">
                                                        <div className="w-2.5 h-2.5 relative">
                                                            <Image
                                                                src="/data/icon/birthday.webp"
                                                                alt="Birthday"
                                                                fill
                                                                className="object-contain"
                                                                unoptimized
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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
            </div>
        </MainLayout>
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
