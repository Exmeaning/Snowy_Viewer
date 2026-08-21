"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import MainLayout from "@/components/MainLayout";
import DetailPageAdCard from "@/components/DetailPageAdCard";
import ExternalLink from "@/components/ExternalLink";
import { IMangaItem, IMangaData } from "@/types/manga";
import { getMangaImageUrl } from "@/lib/assets";
import { fetchMangaData } from "@/lib/fetch";

// ==================== Component ====================

export default function MangaDetailClient() {
    const params = useParams();
    const mangaId = Number(params.id);
    const { setDetailName } = useBreadcrumb();
    const { t, formatDate } = useI18n();

    const [allMangas, setAllMangas] = useState<IMangaItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jumpInput, setJumpInput] = useState("");
    const [isBilingualOpen, setIsBilingualOpen] = useState(false);
    const [isFloatMenuOpen, setIsFloatMenuOpen] = useState(false);

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
                setError(err instanceof Error ? err.message : t("page.manga.unknownError"));
            } finally {
                setIsLoading(false);
            }
        }
        fetchMangas();
    }, [t]);

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
            document.title = t("page.manga.detailDocumentTitle", { id: currentManga.id, title: currentManga.title });
        }
    }, [currentManga, t]);

    // Set breadcrumb detail name
    useEffect(() => {
        if (currentManga) setDetailName(t("page.manga.episodeWithTitle", { id: currentManga.id, title: currentManga.title }));
    }, [currentManga, setDetailName, t]);

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
                        <p className="hh-body mt-4 text-[var(--hh-text-secondary)]">{t("page.manga.loading")}</p>
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
                        <div className="w-24 h-24 mx-auto mb-6 rounded-[var(--hh-radius-full)] bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
                            <svg className="w-12 h-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="hh-display text-2xl text-[var(--hh-text-primary)] mb-2">{t("page.manga.notFoundTitle", { id: mangaId })}</h2>
                        <p className="hh-body text-[var(--hh-text-secondary)] mb-6">{t("page.manga.notFoundDesc")}</p>
                        <Link
                            href="/manga"
                            className="hh-btn hh-btn-primary hh-press px-6 py-3"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            {t("page.manga.backToList")}
                        </Link>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl relative">
                {/* Top Navigation Bar: Prev / Jump / Next */}
                <div className="hh-panel flex items-center justify-between mb-6 px-5 py-4">
                    {/* Prev */}
                    {prevManga ? (
                        <Link
                            href={`/manga/${prevManga.id}`}
                            className="flex items-center gap-1.5 text-sm text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent)] transition-colors font-medium group"
                        >
                            <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline">{t("page.manga.episodeLabel", { id: prevManga.id })}</span>
                            <span className="sm:hidden">{t("page.manga.previousEpisode")}</span>
                        </Link>
                    ) : (
                        <div className="hh-body text-sm text-[var(--hh-text-tertiary)]">{t("page.manga.firstEpisodeReached")}</div>
                    )}

                    {/* Jump to */}
                    <div className="flex items-center gap-2">
                        <span className="hh-label hidden sm:inline">{t("page.manga.jumpLabel")}</span>
                        <input
                            type="number"
                            min={1}
                            value={jumpInput}
                            onChange={(e) => setJumpInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleJump(); }}
                            placeholder={`${currentManga.id}`}
                            className="hh-input hh-numeric w-16 px-2.5 py-1.5 text-center text-sm"
                        />
                        <button
                            onClick={handleJump}
                            className="hh-btn hh-press px-3 py-1.5 text-xs"
                        >
                            GO
                        </button>
                    </div>

                    {/* Next */}
                    {nextManga ? (
                        <Link
                            href={`/manga/${nextManga.id}`}
                            className="flex items-center gap-1.5 text-sm text-[var(--hh-text-secondary)] hover:text-[var(--hh-accent)] transition-colors font-medium group"
                        >
                            <span className="hidden sm:inline">{t("page.manga.episodeLabel", { id: nextManga.id })}</span>
                            <span className="sm:hidden">{t("page.manga.nextEpisode")}</span>
                            <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ) : (
                        <div className="hh-body text-sm text-[var(--hh-text-tertiary)]">{t("page.manga.latestEpisodeReached")}</div>
                    )}
                </div>

                {/* Header */}
                <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className="hh-chip hh-chip-active hh-numeric">
                            {t("page.manga.episodeLabel", { id: currentManga.id })}
                        </span>
                        <span className="hh-numeric text-xs text-[var(--hh-text-tertiary)] font-medium">
                            {formatDate(currentManga.date * 1000, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </span>
                    </div>
                    <h1 className="hh-display text-2xl sm:text-3xl text-[var(--hh-text-primary)] mt-2 mb-4">
                        {currentManga.title}
                    </h1>
                </div>

                {/* Full Manga Image */}
                <div className="hh-tile overflow-hidden mb-6 p-1">
                    <img
                        src={getMangaImageUrl(currentManga.id)}
                        alt={t("page.manga.imageAlt", { id: currentManga.id, title: currentManga.title })}
                        className="w-full h-auto rounded-[var(--hh-radius-md)]"
                        loading="eager"
                    />
                </div>

                {/* Info Card: Contributors + Source Link */}
                <div className="hh-tile overflow-hidden mb-8">
                    <div className="px-5 py-4 border-b border-[var(--hh-border)] bg-[var(--hh-accent-wash)]">
                        <h2 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                            <svg className="w-5 h-5 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t("page.manga.mangaInfo")}
                        </h2>
                    </div>
                    <div className="divide-y divide-[var(--hh-border)]">
                        {/* Contributors */}
                        {currentManga.contributors && Object.keys(currentManga.contributors).length > 0 && (
                            <div className="px-5 py-4">
                                <p className="hh-label mb-3">{t("page.manga.contributors")}</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(currentManga.contributors).map(([role, name]) => (
                                        <span
                                            key={role}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--hh-surface-1)] border border-[var(--hh-border)] rounded-[var(--hh-radius-md)] text-xs"
                                        >
                                            <span className="font-bold text-[var(--hh-text-secondary)]">{role}</span>
                                            <span className="text-[var(--hh-text-primary)] font-medium">{name}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Source link */}
                        <div className="px-5 py-4 flex items-center justify-between">
                            <span className="hh-body text-sm text-[var(--hh-text-secondary)] font-medium">{t("page.manga.source")}</span>
                            <ExternalLink
                                href={currentManga.url}
                                className="hh-btn hh-press px-4 py-2 text-xs"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                {t("page.manga.viewOriginalPost")}
                            </ExternalLink>
                        </div>
                    </div>
                </div>

                <div className="mb-8 max-w-xl mx-auto">
                    <DetailPageAdCard />
                </div>

                {/* Bottom Navigation: Prev / Next (large) */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {prevManga ? (
                        <Link
                            href={`/manga/${prevManga.id}`}
                            className="hh-tile hh-press flex flex-col items-start gap-1.5 p-5 hover:border-[var(--hh-accent-line)] group"
                        >
                            <span className="hh-label group-hover:text-[var(--hh-accent)] transition-colors flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                {t("page.manga.previousEpisode")}
                            </span>
                            <span className="hh-title text-sm text-[var(--hh-text-primary)] group-hover:text-[var(--hh-accent)] transition-colors truncate w-full">
                                {t("page.manga.episodeWithTitle", { id: prevManga.id, title: prevManga.title })}
                            </span>
                        </Link>
                    ) : (
                        <div />
                    )}

                    {nextManga ? (
                        <Link
                            href={`/manga/${nextManga.id}`}
                            className="hh-tile hh-press flex flex-col items-end gap-1.5 p-5 hover:border-[var(--hh-accent-line)] group text-right"
                        >
                            <span className="hh-label group-hover:text-[var(--hh-accent)] transition-colors flex items-center gap-1">
                                {t("page.manga.nextEpisode")}
                                <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </span>
                            <span className="hh-title text-sm text-[var(--hh-text-primary)] group-hover:text-[var(--hh-accent)] transition-colors truncate w-full">
                                {t("page.manga.episodeWithTitle", { id: nextManga.id, title: nextManga.title })}
                            </span>
                        </Link>
                    ) : (
                        <div />
                    )}
                </div>
            </div>

            {/* Bilingual Floating Trigger Button */}
            <div className="fixed bottom-24 right-6 z-40">
                <button
                    onClick={() => setIsBilingualOpen(true)}
                    className="hh-press hh-focusable w-14 h-14 rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-2)] border border-[var(--hh-border)] shadow-[var(--hh-shadow-float)] flex items-center justify-center cursor-pointer hover:bg-[var(--hh-surface-3)] group"
                    title={t("page.story.reader.mangaPanel")}
                >
                    <svg className="w-6 h-6 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </button>
            </div>

            {/* Flip Navigation Float-Ball */}
            <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
                {/* Expanded Quick Navigation Card */}
                {isFloatMenuOpen && (
                    <div className="hh-float hh-animate-sheet-in p-4 w-64">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--hh-border)]">
                            <span className="hh-label">
                                {t("page.story.reader.floatBallMenu")}
                            </span>
                            <button
                                onClick={() => setIsFloatMenuOpen(false)}
                                className="hh-press p-1 rounded-[var(--hh-radius-sm)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Prev & Next Quick Buttons */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {prevManga ? (
                                <Link
                                    href={`/manga/${prevManga.id}`}
                                    className="hh-btn hh-press py-2 text-xs"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    {t("page.manga.previousEpisode")}
                                </Link>
                            ) : (
                                <button disabled className="hh-btn py-2 text-xs opacity-40 cursor-not-allowed">
                                    {t("page.manga.previousEpisode")}
                                </button>
                            )}

                            {nextManga ? (
                                <Link
                                    href={`/manga/${nextManga.id}`}
                                    className="hh-btn hh-press py-2 text-xs"
                                >
                                    {t("page.manga.nextEpisode")}
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            ) : (
                                <button disabled className="hh-btn py-2 text-xs opacity-40 cursor-not-allowed">
                                    {t("page.manga.nextEpisode")}
                                </button>
                            )}
                        </div>

                        {/* Fast chapters jump list */}
                        <div className="hh-well max-h-40 overflow-y-auto custom-scrollbar p-1">
                            {allMangas.map((m) => (
                                <Link
                                    key={m.id}
                                    href={`/manga/${m.id}`}
                                    className={`hh-numeric flex items-center justify-between px-2.5 py-1.5 rounded-[var(--hh-radius-sm)] text-xs transition-colors my-0.5 ${
                                        m.id === currentManga.id
                                            ? "bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] font-bold"
                                            : "text-[var(--hh-text-secondary)] hover:bg-[var(--hh-surface-2)] hover:text-[var(--hh-text-primary)]"
                                    }`}
                                >
                                    <span>#{m.id}</span>
                                    <span className="truncate max-w-[130px] text-right">{m.title}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* The Floating Ball itself */}
                <button
                    onClick={() => setIsFloatMenuOpen(!isFloatMenuOpen)}
                    className="hh-press hh-focusable w-14 h-14 rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-2)] border border-[var(--hh-border)] shadow-[var(--hh-shadow-float)] flex items-center justify-center cursor-pointer hover:bg-[var(--hh-surface-3)] group z-50"
                    title={t("page.story.reader.floatBallMenu")}
                >
                    <svg
                        className={`w-6 h-6 text-miku transition-transform duration-500 ${isFloatMenuOpen ? "rotate-180 scale-90" : "group-hover:rotate-12"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        {isFloatMenuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Bilingual split comparison & Translation notes */}
            <div className={`fixed inset-y-0 right-0 w-80 md:w-96 bg-[var(--hh-surface-1)] border-l border-[var(--hh-border)] shadow-[var(--hh-shadow-float)] z-50 p-6 flex flex-col transition-transform duration-300 ease-out transform ${
                isBilingualOpen ? "translate-x-0" : "translate-x-full"
            }`}>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--hh-border)] shrink-0">
                    <h3 className="hh-title text-[var(--hh-text-primary)] flex items-center gap-2">
                        <svg className="w-5 h-5 text-[var(--hh-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        {t("page.story.reader.mangaPanel")}
                    </h3>
                    <button
                        onClick={() => setIsBilingualOpen(false)}
                        className="hh-press p-1 rounded-[var(--hh-radius-sm)] text-[var(--hh-text-tertiary)] hover:bg-[var(--hh-surface-sunken)] hover:text-[var(--hh-text-primary)]"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Drawer Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Bilingual Metadata */}
                    <div className="space-y-3">
                        <h4 className="hh-label">
                            {t("page.story.reader.bilingualTitle")}
                        </h4>
                        <div className="hh-well p-4">
                            <div className="mb-2">
                                <span className="hh-label block mb-0.5">CHINESE VERSION</span>
                                <span className="hh-title text-sm text-[var(--hh-text-primary)]">{currentManga.title}</span>
                            </div>
                            <div>
                                <span className="hh-label block mb-0.5">JAPANESE ORIGINAL</span>
                                <span className="hh-body text-sm text-[var(--hh-text-secondary)] italic">
                                    Project SEKAI 4-Koma Comic #{currentManga.id}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Contributors & Translation credits */}
                    <div className="space-y-3">
                        <h4 className="hh-label">
                            {t("page.manga.contributors")}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                            {currentManga.contributors && Object.entries(currentManga.contributors).map(([role, name]) => (
                                <div
                                    key={role}
                                    className="flex items-center justify-between p-3 bg-[var(--hh-surface-2)] border border-[var(--hh-border)] rounded-[var(--hh-radius-lg)]"
                                >
                                    <span className="hh-label">{role}</span>
                                    <span className="text-xs text-[var(--hh-accent)] font-semibold">{name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Translator Essay / Commentary */}
                    <div className="space-y-3">
                        <h4 className="hh-label">
                            {t("page.story.reader.mangaEssayTitle")}
                        </h4>
                        <div className="hh-well hh-body p-4 space-y-3 text-xs text-[var(--hh-text-secondary)]">
                            <p>
                                💡 <span className="font-bold">{t("page.manga.contributors")}：</span>
                                {t("page.story.reader.mangaEssay1")}
                            </p>
                            <p>
                                📚 <span className="font-bold">{t("page.manga.mangaInfo")}：</span>
                                {t("page.story.reader.mangaEssay2")}
                            </p>
                            <p className="border-t border-[var(--hh-border)] pt-2 text-[10px] text-[var(--hh-text-tertiary)] italic text-center">
                                {t("page.story.reader.mangaEssayFooter")}
                            </p>
                        </div>
                    </div>

                    {/* Source Post */}
                    <div className="space-y-3">
                        <h4 className="hh-label">
                            {t("page.manga.source")}
                        </h4>
                        <ExternalLink
                            href={currentManga.url}
                            className="hh-btn hh-press w-full py-3 px-4 text-xs"
                        >
                            <svg className="w-4 h-4 text-miku" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            {t("page.manga.viewOriginalPost")}
                        </ExternalLink>
                    </div>
                </div>
            </div>

            {/* Backdrop for Bilingual Panel */}
            {isBilingualOpen && (
                <div
                    onClick={() => setIsBilingualOpen(false)}
                    // Tap-outside dismissal for the bilingual panel. Every other
                    // dismissal path in the app is audible ("back"); this scrim was
                    // the silent one, so closing by scrim felt unresponsive.
                    data-hh-click
                    data-hh-sound="back"
                    className="hh-scrim fixed inset-0 z-45 transition-opacity"
                />
            )}
        </MainLayout>
    );
}
