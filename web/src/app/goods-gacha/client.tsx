'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import MainLayout from '@/components/MainLayout';
import ExternalLink from '@/components/ExternalLink';
import { useI18n } from '@/contexts/I18nContext';

interface GachaClientProps {
    pools: Record<string, string[]>;
}

export default function GachaClient({ pools }: GachaClientProps) {
    const { t } = useI18n();
    const poolNames = Object.keys(pools);
    const [selectedPool, setSelectedPool] = useState<string>(poolNames[0] || '');
    const [results, setResults] = useState<string[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // History state: Record<PoolName, Record<ImageSrc, Count>>
    const [history, setHistory] = useState<Record<string, Record<string, number>>>({});

    const handlePoolChange = (poolName: string) => {
        setSelectedPool(poolName);
        setResults([]);
        setShowResults(false);
    };

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
        if (confirm(t("page.goodsGacha.resetConfirm"))) {
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
                <div className="pt-4 min-h-screen flex items-center justify-center hh-body text-[var(--hh-text-secondary)]">
                    <p>{t("page.goodsGacha.noPools")}</p>
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
        <MainLayout>
            <div className="pt-4 min-h-screen pb-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-8">

                    {/* Page Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--hh-accent-line)] bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                            <span className="hh-label text-[var(--hh-accent)]">{t("page.goodsGacha.badge")}</span>
                        </div>
                        <h1 className="hh-display text-3xl sm:text-4xl text-[var(--hh-text-primary)]">
                            {t("page.goodsGacha.title")} <span className="text-[var(--hh-accent)]">{t("page.goodsGacha.titleHighlight")}</span>
                        </h1>
                        <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">
                            {t("page.goodsGacha.description")}
                        </p>
                    </div>

                    {/* Pool Selector */}
                    <div className="mb-12">
                        <h2 className="hh-title text-lg text-[var(--hh-text-primary)] mb-4 px-2 border-l-4 border-[var(--hh-accent)]">{t("page.goodsGacha.selectPool")}</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {poolNames.map((poolName) => (
                                <button
                                    key={poolName}
                                    onClick={() => handlePoolChange(poolName)}
                                    className={`hh-press hh-focusable relative p-4 rounded-[var(--hh-radius-lg)] border flex flex-col items-center gap-3 group
                                        ${selectedPool === poolName
                                            ? 'border-[var(--hh-accent)] bg-[var(--hh-accent-wash)] shadow-[var(--hh-shadow-raised)]'
                                            : 'border-[var(--hh-border)] bg-[var(--hh-surface-2)] shadow-[var(--hh-shadow-tile)] hover:border-[var(--hh-border-strong)]'
                                        }`}
                                >
                                    {/* Preview first image of pool if available */}
                                    <div className="w-16 h-16 relative rounded-[var(--hh-radius-full)] overflow-hidden bg-[var(--hh-surface-sunken)] border border-[var(--hh-border)]">
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
                                    <span className={`text-sm font-semibold text-center line-clamp-2 ${selectedPool === poolName ? 'text-[var(--hh-accent)]' : 'text-[var(--hh-text-secondary)] group-hover:text-[var(--hh-text-primary)]'}`}>
                                        {poolName}
                                    </span>
                                    {selectedPool === poolName && (
                                        <div className="absolute top-2 right-2 w-2 h-2 bg-[var(--hh-accent)] rounded-[var(--hh-radius-full)]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Action Area */}
                    <div className="hh-panel p-6 md:p-10 mb-12 relative overflow-hidden min-h-[400px] flex flex-col items-center justify-center">

                        {/* Background Pattern — neutral grey rather than the old
                            hardcoded teal: the accent now follows the character
                            theme, so a fixed brand tint here would drift out of
                            sync with every non-default theme. */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none"
                            style={{
                                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239b9ea5' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E\")",
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
                                                className="aspect-square relative bg-[var(--hh-surface-2)] rounded-[var(--hh-radius-lg)] border border-[var(--hh-border)] shadow-[var(--hh-shadow-tile)] overflow-hidden group hover:border-[var(--hh-border-strong)] hh-press cursor-pointer"
                                                onClick={() => window.open(src, '_blank')}
                                            >
                                                <Image
                                                    src={src}
                                                    alt={t("page.goodsGacha.resultAlt", { index: index + 1 })}
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
                        <div className={`z-10 flex flex-col items-center gap-6 w-full max-w-md mx-auto ${showResults ? 'mt-4' : ''}`}>
                            {!showResults && (
                                <div className="hh-title text-xl text-[var(--hh-text-primary)]">
                                    {t("page.goodsGacha.currentPool")} <span className="text-[var(--hh-accent)]">{selectedPool}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-6 w-full">
                                <button
                                    onClick={() => draw(1)}
                                    disabled={isAnimating}
                                    className="hh-btn hh-press hh-focusable flex-1 py-2 sm:py-4 rounded-[var(--hh-radius-md)] disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-1"
                                >
                                    <span className="text-sm sm:text-lg">{t("page.goodsGacha.singleDraw")}</span>
                                    <span className="text-[10px] sm:text-xs opacity-80 font-normal">{t("page.goodsGacha.singleDrawCost")}</span>
                                </button>
                                <button
                                    onClick={() => draw(10)}
                                    disabled={isAnimating}
                                    className="hh-btn hh-btn-primary hh-press hh-focusable flex-1 py-2 sm:py-4 rounded-[var(--hh-radius-md)] disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-1"
                                >
                                    <span className="text-sm sm:text-lg">{t("page.goodsGacha.tenDraw")}</span>
                                    <span className="text-[10px] sm:text-xs opacity-80 font-normal">{t("page.goodsGacha.tenDrawCost")}</span>
                                </button>
                            </div>

                            {/* Statistics Summary */}
                            <div className="text-sm text-[var(--hh-text-secondary)] font-medium flex gap-4">
                                <span>{t("page.goodsGacha.totalDraws")} <b className="hh-numeric text-[var(--hh-text-primary)]">{totalDraws}</b></span>
                                <span>{t("page.goodsGacha.completionRate")} <b className="hh-numeric text-[var(--hh-accent)]">{completionRate}%</b> <span className="hh-numeric">({uniqueObtained}/{currentPoolImages.length})</span></span>
                            </div>
                        </div>

                        {/* Animation Overlay — opaque fill rather than a blurred veil:
                            the blur utility is neutralized system-wide, so a
                            translucent tint alone would leak the grid underneath. */}
                        <AnimatePresence>
                            {isAnimating && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-20 bg-[var(--hh-surface-1)] flex items-center justify-center"
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
                                            className="w-24 h-24 rounded-[var(--hh-radius-full)] border-4 border-t-[var(--hh-accent)] border-r-transparent border-b-[var(--hh-accent)] border-l-transparent"
                                        />
                                        <motion.p
                                            animate={{ opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="hh-title text-[var(--hh-accent)] text-xl"
                                        >
                                            {t("page.goodsGacha.praying")}
                                        </motion.p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Pool Details & History */}
                    <div className="hh-panel overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-surface-1)] flex items-center justify-between">
                            <h2 className="hh-title text-lg text-[var(--hh-text-primary)] flex items-center gap-2">
                                <svg className="w-5 h-5 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                {t("page.goodsGacha.poolDetails", { count: currentPoolImages.length })}
                            </h2>
                            <button
                                onClick={resetHistory}
                                disabled={totalDraws === 0}
                                className="hh-chip hh-press hh-focusable disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t("page.goodsGacha.resetHistory")}
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
                                            className={`relative aspect-square rounded-[var(--hh-radius-md)] border overflow-hidden
                                                ${isObtained
                                                    ? 'border-[var(--hh-accent)] bg-[var(--hh-surface-2)]'
                                                    : 'border-[var(--hh-border-hairline)] bg-[var(--hh-surface-sunken)] opacity-60 grayscale'
                                                }`}
                                        >
                                            <Image
                                                src={src}
                                                alt={t("page.goodsGacha.poolItemAlt", { index: idx + 1 })}
                                                fill
                                                className="object-contain p-1"
                                                sizes="128px"
                                            />
                                            {isObtained && (
                                                <div className="absolute bottom-0 right-0 z-10 bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] text-[10px] font-bold px-1.5 py-0.5 rounded-tl-[var(--hh-radius-sm)] leading-none flex items-center gap-0.5">
                                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                    {count > 1 && <span className="hh-numeric">×{count}</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Disclaimer Footer */}
                    <div className="mt-12 pt-8 border-t border-[var(--hh-border)] text-center hh-body text-[var(--hh-text-tertiary)] text-sm space-y-2">
                        <p>
                            {t("page.goodsGacha.disclaimer.unofficial")}
                        </p>
                        <p>
                            {t("page.goodsGacha.disclaimer.reference")}
                        </p>
                        <p className="text-xs mt-4">
                            {t("page.goodsGacha.disclaimer.noRealTrade")}
                        </p>
                        <p className="text-xs mt-2">
                            {t("page.goodsGacha.disclaimer.sourcePrefix")} <ExternalLink href="https://github.com/Caffeine-co/Shinonome_Ena" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--hh-accent)] transition-colors underline decoration-dotted">Caffeine-co/Shinonome_Ena</ExternalLink>
                        </p>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
