"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import ExternalLink from "@/components/ExternalLink";
import { IMangaItem, IMangaData } from "@/types/manga";
import { getMangaImageUrl } from "@/lib/assets";
import { fetchMangaData } from "@/lib/fetch";

// ==================== Constants ====================

function formatDate(timestamp: number): string {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

// ==================== Component ====================

export default function MangaDetailClient() {
    const params = useParams();
    const mangaId = Number(params.id);
    const { setDetailName } = useBreadcrumb();

    const [allMangas, setAllMangas] = useState<IMangaItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jumpInput, setJumpInput] = useState("");

    // Fetch all mangas
    useEffect(() => {
        async function fetchMangas() {
            try {
                setIsLoading(true);
                const data = await fetchMangaData<IMangaData>();
                const list = Object.values(data).sort((a, b) => a.id - b.id);
                setAllMangas(list);
                setError(null);
            } catch (err) {
                console.error("Error fetching mangas:", err);
                setError(err instanceof Error ? err.message : "未知错误");
            } finally {
                setIsLoading(false);
            }
        }
        fetchMangas();
    }, []);

    // Current manga
    const currentManga = useMemo(() => {
        return allMangas.find((m) => m.id === mangaId) || null;
    }, [allMangas, mangaId]);

    // Prev / Next based on sorted list
    const { prevManga, nextManga } = useMemo(() => {
        const idx = allMangas.findIndex((m) => m.id === mangaId);
        return {
            prevManga: idx > 0 ? allMangas[idx - 1] : null,
            nextManga: idx >= 0 && idx < allMangas.length - 1 ? allMangas[idx + 1] : null,
        };
    }, [allMangas, mangaId]);

    // Update page title
    useEffect(() => {
        if (currentManga) {
            document.title = `Moesekai - 第${currentManga.id}话 ${currentManga.title}`;
        }
    }, [currentManga]);

    // Set breadcrumb detail name
    useEffect(() => {
        if (currentManga) setDetailName(`第${currentManga.id}话 ${currentManga.title}`);
    }, [currentManga, setDetailName]);

    // Keyboard navigation: ← prev, → next
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === "ArrowLeft" && prevManga) {
                window.location.href = `/manga/${prevManga.id}`;
            } else if (e.key === "ArrowRight" && nextManga) {
                window.location.href = `/manga/${nextManga.id}`;
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [prevManga, nextManga]);

    // Handle jump to episode
    const handleJump = () => {
        const num = parseInt(jumpInput.trim(), 10);
        if (!isNaN(num) && num > 0) {
            window.location.href = `/manga/${num}`;
        }
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="flex flex-col items-center justify-center min-h-[50vh]">
                        <div className="loading-spinner"></div>
                        <p className="mt-4 text-slate-500">加载中...</p>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (error || !currentManga) {
        return (
            <MainLayout>
                <div className="container mx-auto px-4 py-16">
                    <div className="max-w-md mx-auto text-center">
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">第 {mangaId} 话未找到</h2>
                        <p className="text-slate-500 mb-6">该漫画可能尚未收录</p>
                        <Link
                            href="/manga"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-miku text-white font-bold rounded-xl hover:bg-miku-dark transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            返回漫画列表
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
                {/* Top Navigation Bar: Prev / Jump / Next */}
                <div className="flex items-center justify-between mb-6 bg-white rounded-xl shadow ring-1 ring-slate-200 px-4 py-3">
                    {/* Prev */}
                    {prevManga ? (
                        <Link
                            href={`/manga/${prevManga.id}`}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-miku transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline">第{prevManga.id}话</span>
                            <span className="sm:hidden">上一话</span>
                        </Link>
                    ) : (
                        <div className="text-sm text-slate-300">已是第一话</div>
                    )}

                    {/* Jump to */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 hidden sm:inline">跳转</span>
                        <input
                            type="number"
                            min={1}
                            value={jumpInput}
                            onChange={(e) => setJumpInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleJump(); }}
                            placeholder={`${currentManga.id}`}
                            className="w-16 px-2 py-1 text-center text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-miku/30 focus:border-miku"
                        />
                        <button
                            onClick={handleJump}
                            className="px-3 py-1 text-xs font-bold bg-miku/10 text-miku rounded-lg hover:bg-miku/20 transition-colors"
                        >
                            GO
                        </button>
                    </div>

                    {/* Next */}
                    {nextManga ? (
                        <Link
                            href={`/manga/${nextManga.id}`}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-miku transition-colors"
                        >
                            <span className="hidden sm:inline">第{nextManga.id}话</span>
                            <span className="sm:hidden">下一话</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ) : (
                        <div className="text-sm text-slate-300">已是最新话</div>
                    )}
                </div>

                {/* Header */}
                <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-miku/10 rounded-full text-xs font-bold text-miku">
                            第{currentManga.id}话
                        </span>
                        <span className="text-xs text-slate-400">
                            {formatDate(currentManga.date)}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800">
                        {currentManga.title}
                    </h1>
                </div>

                {/* Full Manga Image */}
                <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden mb-6">
                    <img
                        src={getMangaImageUrl(currentManga.id)}
                        alt={`第${currentManga.id}话 ${currentManga.title}`}
                        className="w-full h-auto"
                        loading="eager"
                    />
                </div>

                {/* Info Card: Contributors + Source Link */}
                <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200 overflow-hidden mb-8">
                    <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-miku/5 to-transparent">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            漫画信息
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {/* Contributors */}
                        {currentManga.contributors && Object.keys(currentManga.contributors).length > 0 && (
                            <div className="px-5 py-3">
                                <p className="text-xs font-bold text-slate-400 mb-2">翻译贡献者</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(currentManga.contributors).map(([role, name]) => (
                                        <span
                                            key={role}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full text-xs"
                                        >
                                            <span className="font-bold text-slate-500">{role}</span>
                                            <span className="text-slate-600">{name}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Source link */}
                        <div className="px-5 py-3 flex items-center justify-between">
                            <span className="text-sm text-slate-500">来源</span>
                            <ExternalLink
                                href={currentManga.url}
                                className="inline-flex items-center gap-1.5 text-sm text-miku hover:text-miku-dark transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                查看原帖
                            </ExternalLink>
                        </div>
                    </div>
                </div>

                <div className="mb-8 max-w-xl mx-auto">
                    <DetailPageAdCard />
                </div>

                {/* Bottom Navigation: Prev / Next (large) */}
                <div className="grid grid-cols-2 gap-4">
                    {prevManga ? (
                        <Link
                            href={`/manga/${prevManga.id}`}
                            className="flex flex-col items-start gap-1 p-4 bg-white rounded-xl shadow ring-1 ring-slate-200 hover:ring-miku hover:shadow-lg transition-all group"
                        >
                            <span className="text-xs text-slate-400 group-hover:text-miku transition-colors flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                上一话
                            </span>
                            <span className="text-sm font-bold text-slate-700 group-hover:text-miku transition-colors truncate w-full">
                                第{prevManga.id}话 {prevManga.title}
                            </span>
                        </Link>
                    ) : (
                        <div />
                    )}

                    {nextManga ? (
                        <Link
                            href={`/manga/${nextManga.id}`}
                            className="flex flex-col items-end gap-1 p-4 bg-white rounded-xl shadow ring-1 ring-slate-200 hover:ring-miku hover:shadow-lg transition-all group text-right"
                        >
                            <span className="text-xs text-slate-400 group-hover:text-miku transition-colors flex items-center gap-1">
                                下一话
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </span>
                            <span className="text-sm font-bold text-slate-700 group-hover:text-miku transition-colors truncate w-full">
                                第{nextManga.id}话 {nextManga.title}
                            </span>
                        </Link>
                    ) : (
                        <div />
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
