"use client";
import Link from "@/components/LocalizedLink";
import { useI18n } from "@/contexts/I18nContext";
import { getStoryType, StoryTypeKey } from "@/lib/storyTypes";

interface StoryPageHeaderProps {
    storyKey: StoryTypeKey;
}

export function StoryPageHeader({ storyKey }: StoryPageHeaderProps) {
    const { t } = useI18n();
    const storyType = getStoryType(storyKey);

    return (
        <div className="mb-8">
            <Link href="/story" className="inline-flex items-center gap-1.5 text-[var(--hh-text-tertiary)] hover:text-miku transition-colors text-sm mb-6">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t("page.story.backToStory")}
            </Link>
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-miku/30 bg-[var(--hh-accent-wash)] rounded-[var(--hh-radius-md)] mb-4">
                    <span className="hh-label text-miku text-xs">{t("page.story.badge")}</span>
                </div>
                <h1 className="hh-display text-3xl sm:text-4xl font-black text-[var(--hh-text-primary)]">{t(storyType.nameKey)}</h1>
                <p className="hh-body text-[var(--hh-text-secondary)] mt-2 max-w-2xl mx-auto">{t(storyType.descKey)}</p>
            </div>
        </div>
    );
}
