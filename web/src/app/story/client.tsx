"use client";
import Link from "@/components/LocalizedLink";
import MainLayout from "@/components/MainLayout";
import { useI18n } from "@/contexts/I18nContext";
import { STORY_TYPES } from "@/lib/storyTypes";

export default function StoryIndexClient() {
    const { t } = useI18n();

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                        <span className="hh-label text-miku text-xs">{t("page.story.badge")}</span>
                    </div>
                    <h1 className="hh-display text-3xl sm:text-4xl font-black text-primary-text">
                        {t("page.story.title")} <span className="text-miku">{t("page.story.titleHighlight")}</span>
                    </h1>
                    <p className="hh-body text-[var(--hh-text-secondary)] mt-2">{t("page.story.description")}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
                    {STORY_TYPES.map((storyType) => (
                        <Link
                            key={storyType.href}
                            href={storyType.href}
                            className="hh-tile hh-press hh-focusable group relative overflow-hidden transition-colors hover:border-[var(--hh-accent-line)]"
                        >
                            <div className="p-6 flex items-start gap-4">
                                <div className={`shrink-0 w-14 h-14 rounded-[var(--hh-radius-md)] ${storyType.color} flex items-center justify-center text-white`}>
                                    {storyType.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="hh-title font-bold text-lg text-[var(--hh-text-primary)] group-hover:text-miku transition-colors">
                                        {t(storyType.nameKey)}
                                    </h2>
                                    <p className="text-sm text-[var(--hh-text-secondary)] mt-1 leading-relaxed">
                                        {t(storyType.descKey)}
                                    </p>
                                </div>
                                <svg className="w-5 h-5 text-[var(--hh-text-tertiary)] group-hover:text-miku transition-all group-hover:translate-x-1 shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
