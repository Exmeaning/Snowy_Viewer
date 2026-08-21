"use client";
import PageHeader from "@/components/common/PageHeader";
import { useI18n } from "@/contexts/I18nContext";
import { getStoryType, StoryTypeKey } from "@/lib/storyTypes";

interface StoryPageHeaderProps {
    storyKey: StoryTypeKey;
}

/**
 * Story section header.
 *
 * Delegates to the shared PageHeader so every story listing inherits the same
 * banner treatment as the rest of the site. The story name comes from
 * masterdata-backed dictionaries and is a single phrase, so no `titleHighlight`
 * is passed — the accent split does not apply here.
 */
export function StoryPageHeader({ storyKey }: StoryPageHeaderProps) {
    const { t } = useI18n();
    const storyType = getStoryType(storyKey);

    return (
        <PageHeader
            badge={t("page.story.badge")}
            title={t(storyType.nameKey)}
            description={t(storyType.descKey)}
            backLink={{ href: "/story", label: t("page.story.backToStory") }}
        />
    );
}
