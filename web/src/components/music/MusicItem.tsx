"use client";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { IMusicInfo, getMusicJacketUrl, MUSIC_CATEGORY_COLORS, MusicCategoryType, MusicDifficultyType, DIFFICULTY_COLORS } from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTranslation } from "@/contexts/TranslationContext";

const ALL_DIFFICULTIES: MusicDifficultyType[] = ["easy", "normal", "hard", "expert", "master", "append"];
// The blur here was what separated the badge from a busy jacket; .hh-badge-on-media
// carries that contrast in an opaque plate instead, so no live compositor blur.
const JACKET_OVERLAY_BADGE_CLASS = "hh-badge-on-media hh-numeric inline-flex h-5 items-center px-1.5 text-[10px] font-normal leading-4";

interface MusicItemProps {
    music: IMusicInfo;
    isSpoiler?: boolean;
    constant?: number;
    difficulties?: Record<string, number>;
    showDifficulty?: boolean;
    cnTitle?: string;
    enTitle?: string;
    href?: string;
    hrefBase?: string;
    jacketTopLeftLabel?: string;
}

export default function MusicItem({ music, isSpoiler, constant, difficulties, showDifficulty, cnTitle, enTitle, href, hrefBase = "/music", jacketTopLeftLabel }: MusicItemProps) {
    const { assetSource, useLLMTranslation } = useTheme();
    const { locale, t } = useI18n();
    const { t: translateMasterText } = useTranslation();
    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);
    const indexedTitle = locale === "zh-CN" ? cnTitle : locale === "en-US" ? enTitle : undefined;
    const translatedTitle = translateMasterText("music", "title", music.title) ?? (useLLMTranslation ? indexedTitle : undefined);
    const itemHref = href ?? `${hrefBase}/${music.id}`;

    return (
        <Link
            href={itemHref}
            className="hh-card-item block h-full flex flex-col select-none cursor-pointer overflow-hidden group"
            data-shortcut-item="true"
        >
            {/* Jacket Image */}
            <div className="relative aspect-square overflow-hidden shrink-0">
                <Image
                    src={jacketUrl}
                    alt={music.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover"
                    unoptimized
                    loading="lazy"
                    decoding="async"
                />

                {/* Category Tags Overlay — category colors are semantic. */}
                <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                    {Array.from(new Set(music.categories)).map((cat) => (
                        <span
                            key={cat}
                            className="px-1.5 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-xs)] text-white shadow-sm"
                            style={{ backgroundColor: MUSIC_CATEGORY_COLORS[cat as MusicCategoryType] }}
                        >
                            {t(`common.musicCategories.${cat}`)}
                        </span>
                    ))}
                </div>

                {/* ID Badge */}
                <div className={`absolute right-2 top-2 z-10 ${JACKET_OVERLAY_BADGE_CLASS}`}>
                    #{music.id}
                </div>

                {/* Constant Badge - bottom right */}
                {constant !== undefined && (
                    <div className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 rounded-[var(--hh-radius-xs)] bg-[var(--hh-accent)] text-[var(--hh-text-on-accent)] font-bold text-[10px] shadow-sm">
                        {constant.toFixed(1)}
                    </div>
                )}

                {/* Top-left jacket badges use the same compact overlay language as the ID badge. */}
                {(jacketTopLeftLabel || isSpoiler) && (
                    <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
                        {jacketTopLeftLabel && (
                            <span className={JACKET_OVERLAY_BADGE_CLASS}>
                                {jacketTopLeftLabel}
                            </span>
                        )}
                        {isSpoiler && (
                            <span className="rounded-[var(--hh-radius-xs)] bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white shadow-sm">
                                {t("common.badge.spoiler")}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Info Footer with Full Accent Mask */}
            <div className="hh-card-footer p-2.5 sm:p-3 flex flex-col justify-between flex-1 min-h-[90px]">
                <h3 className="hh-title text-xs sm:text-sm font-bold text-[var(--hh-text-primary)] leading-tight">
                    <span className="min-h-[2.5rem] flex flex-col justify-start overflow-hidden">
                        <span className="hh-card-title block truncate">{music.title}</span>
                        {translatedTitle && (
                            <span className="hh-body text-[10px] sm:text-xs font-medium text-[var(--hh-text-tertiary)] block truncate mt-0.5">{translatedTitle}</span>
                        )}
                    </span>
                </h3>
                <p className="hh-body text-[10px] sm:text-xs text-[var(--hh-text-secondary)] mt-1 truncate">
                    {music.composer}
                    {music.composer !== music.arranger && music.arranger !== "-" && ` / ${music.arranger}`}
                </p>
                {showDifficulty && difficulties && (
                    <div className="mt-auto pt-2 flex justify-center gap-1">
                        {ALL_DIFFICULTIES.map(diff => {
                            const level = difficulties[diff];
                            if (level === undefined) return null;
                            return (
                                <span
                                    key={diff}
                                    className="hh-numeric text-[10px] font-bold text-white min-w-[1.25rem] text-center py-0.5 rounded-[var(--hh-radius-xs)] shadow-xs"
                                    style={{ backgroundColor: DIFFICULTY_COLORS[diff] }}
                                >
                                    {level}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
        </Link>
    );
}
