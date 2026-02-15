'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '@/components/MainLayout';
import ExternalLink from '@/components/ExternalLink';

interface GachaClientProps {
    pools: Record<string, string[]>;
}

export default function GachaClient({ pools }: GachaClientProps) {
    const poolNames = Object.keys(pools);
    const [selectedPool, setSelectedPool] = useState<string>(poolNames[0] || '');
    const [results, setResults] = useState<string[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // History state: Record<PoolName, Record<ImageSrc, Count>>
    const [history, setHistory] = useState<Record<string, Record<string, number>>>({});

    // Reset results when pool changes
    useEffect(() => {
        setResults([]);
        setShowResults(false);
    }, [selectedPool]);

    const draw = (count: number) => {
        if (!selectedPool || !pools[selectedPool] || isAnimating) return;

        setIsAnimating(true);
        setShowResults(false);
        setResults([]);

        const currentPool = pools[selectedPool];
        const newResults: string[] = [];

        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * currentPool.length);
            newResults.push(currentPool[randomIndex]);
        }

        // Simulate animation delay
        setTimeout(() => {
            setResults(newResults);

            // Update history
            setHistory(prev => {
                const poolHistory = { ...(prev[selectedPool] || {}) };
                newResults.forEach(src => {
                    poolHistory[src] = (poolHistory[src] || 0) + 1;
                });
                return {
                    ...prev,
                    [selectedPool]: poolHistory
                };
            });

            setIsAnimating(false);
            setShowResults(true);
        }, 1500); // 1.5s animation
    };

    const resetHistory = () => {
        if (confirm("确定要重置当前卡池的抽奖记录吗？")) {
            setHistory(prev => ({
                ...prev,
                [selectedPool]: {}
            }));
            setResults([]);
            setShowResults(false);
        }
    };

    if (poolNames.length === 0) {
        return (
            <MainLayout>
                <div className="pt-4 min-h-screen flex items-center justify-center text-slate-500">
                    <p>暂无卡池数据</p>
                </div>
            </MainLayout>
        );
    }

    const currentPoolImages = pools[selectedPool] || [];
    const currentPoolHistory = history[selectedPool] || {};
    const totalDraws = Object.values(currentPoolHistory).reduce((a, b) => a + b, 0);
    const uniqueObtained = Object.keys(currentPoolHistory).length;
    const completionRate = Math.round((uniqueObtained / currentPoolImages.length) * 100) || 0;

    return (
        <MainLayout activeNav="谷子盲抽">
            <div className="pt-4 min-h-screen pb-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-8">

                    {/* Page Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-miku/5 rounded-full mb-4">
                            <span className="text-miku text-xs font-bold tracking-widest uppercase">Entertainment Tool</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-primary-text">
                            谷子 <span className="text-miku">盲抽模拟</span>
                        </h1>
                        <p className="text-slate-500 mt-2 max-w-2xl mx-auto">
                            选择卡池，消耗运气，试试你的手气吧！
                        </p>
                    </div>

                    {/* Pool Selector */}
                    <div className="mb-12">
                        <h2 className="text-lg font-bold text-slate-700 mb-4 px-2 border-l-4 border-miku">选择卡池</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {poolNames.map((poolName) => (
                                <button
                                    key={poolName}
                                    onClick={() => setSelectedPool(poolName)}
                                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-3 group
                                        ${selectedPool === poolName
                                            ? 'border-miku bg-miku/5 shadow-md scale-105'
                                            : 'border-slate-200 bg-white hover:border-miku/50 hover:shadow-sm'
                                        }`}
                                >
                                    {/* Preview first image of pool if available */}
                                    <div className="w-16 h-16 relative rounded-full overflow-hidden bg-slate-100 border border-slate-100 shadow-inner">
                                        {pools[poolName]?.[0] && (
                                            <Image
                                                src={pools[poolName][0]}
                                                alt={poolName}
                                                fill
                                                className="object-cover"
                                                sizes="64px"
                                            />
                                        )}
                                    </div>
                                    <span className={`text-sm font-bold text-center line-clamp-2 ${selectedPool === poolName ? 'text-miku' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                        {poolName}
                                    </span>
                                    {selectedPool === poolName && (
                                        <div className="absolute top-2 right-2 w-3 h-3 bg-miku rounded-full animate-pulse" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Action Area */}
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-10 mb-12 relative overflow-hidden min-h-[400px] flex flex-col items-center justify-center transition-all duration-500">

                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none"
                            style={{
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2333ccbb' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E\")",
                            }}
                        />

                        {/* Results Display (Moved Inside) */}
                        <AnimatePresence mode="wait">
                            {showResults && results.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="w-full mb-8 z-10"
                                >
                                    <div className="grid grid-cols-5 gap-2 md:gap-4 max-w-3xl mx-auto">
                                        {results.map((src, index) => (
                                            <motion.div
                                                key={`${src}-${index}`}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="aspect-square relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all cursor-pointer"
                                                onClick={() => window.open(src, '_blank')}
                                            >
                                                <Image
                                                    src={src}
                                                    alt={`Result ${index + 1}`}
                                                    fill
                                                    className="object-contain p-1.5 hover:scale-110 transition-transform duration-300"
                                                    sizes="(max-width: 768px) 50vw, 20vw"
                                                />
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Controls */}
                        <div className={`z-10 flex flex-col items-center gap-6 w-full max-w-md mx-auto transition-all ${showResults ? 'mt-4' : ''}`}>
                            {!showResults && (
                                <div className="text-xl font-bold text-slate-700">
                                    当前卡池: <span className="text-miku">{selectedPool}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-6 w-full">
                                <button
                                    onClick={() => draw(1)}
                                    disabled={isAnimating}
                                    className="flex-1 bg-white border-2 border-miku text-miku hover:bg-miku hover:text-white font-bold py-2 sm:py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex flex-col items-center gap-1"
                                >
                                    <span className="text-sm sm:text-lg">单抽</span>
                                    <span className="text-[10px] sm:text-xs opacity-80 font-normal">消耗: 运气</span>
                                </button>
                                <button
                                    onClick={() => draw(10)}
                                    disabled={isAnimating}
                                    className="flex-1 bg-gradient-to-r from-miku to-teal-400 text-white font-bold py-2 sm:py-4 rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:brightness-110 flex flex-col items-center gap-1"
                                >
                                    <span className="text-sm sm:text-lg">十连抽</span>
                                    <span className="text-[10px] sm:text-xs opacity-80 font-normal">消耗运气x10</span>
                                </button>
                            </div>

                            {/* Statistics Summary */}
                            <div className="text-sm text-slate-500 font-medium flex gap-4">
                                <span>总抽数: <b className="text-slate-800">{totalDraws}</b></span>
                                <span>收集率: <b className="text-miku">{completionRate}%</b> ({uniqueObtained}/{currentPoolImages.length})</span>
                            </div>
                        </div>

                        {/* Animation Overlay */}
                        <AnimatePresence>
                            {isAnimating && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex items-center justify-center"
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <motion.div
                                            animate={{
                                                scale: [1, 1.2, 1],
                                                rotate: [0, 180, 360]
                                            }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                ease: "linear"
                                            }}
                                            className="w-24 h-24 rounded-full border-4 border-t-miku border-r-transparent border-b-miku border-l-transparent"
                                        />
                                        <motion.p
                                            animate={{ opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="text-miku font-bold text-xl"
                                        >
                                            祈愿中...
                                        </motion.p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Pool Details & History */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                卡池详情 ({currentPoolImages.length})
                            </h2>
                            <button
                                onClick={resetHistory}
                                disabled={totalDraws === 0}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-red-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                            >
                                重置记录
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-6 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                                {currentPoolImages.map((src, idx) => {
                                    const count = currentPoolHistory[src] || 0;
                                    const isObtained = count > 0;

                                    return (
                                        <div
                                            key={idx}
                                            className={`relative aspect-square rounded-lg border overflow-hidden transition-all
                                                ${isObtained
                                                    ? 'border-green-400 bg-white shadow-sm'
                                                    : 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                                                }`}
                                        >
                                            <Image
                                                src={src}
                                                alt={`Pool Item ${idx}`}
                                                fill
                                                className="object-contain p-1"
                                                sizes="128px"
                                            />
                                            {isObtained && (
                                                <div className="absolute bottom-0 right-0 z-10 bg-gradient-to-l from-green-500 to-green-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded-tl-lg shadow-sm leading-none flex items-center gap-0.5">
                                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                    {count > 1 && <span>×{count}</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Disclaimer Footer */}
                    <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm space-y-2">
                        <p>
                            本工具仅供娱乐，与 SEGA / Colorful Palette / PJSK 官方无关。
                        </p>
                        <p>
                            模拟结果仅供参考，不代表实际周边抽赏结果。
                        </p>
                        <p className="text-xs text-slate-300 mt-4">
                            本页面不涉及任何真实金钱交易或实物奖励，请勿关联现实。
                        </p>
                        <p className="text-xs text-slate-300 mt-2">
                            资源修改于 <ExternalLink href="https://github.com/Caffeine-co/Shinonome_Ena" target="_blank" rel="noopener noreferrer" className="hover:text-miku transition-colors underline decoration-dotted">Caffeine-co/Shinonome_Ena</ExternalLink>
                        </p>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
