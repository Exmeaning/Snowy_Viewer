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
        <Link href={itemHref} className="group hh-press block [content-visibility:auto] [contain-intrinsic-size:auto_320px]" data-shortcut-item="true">
            {/* Tile, not a lifting card: the hover signal is the border. The jacket
                also no longer zooms — scaling an image inside a clipped tile
                repaints the whole cell, and this grid renders hundreds at once. */}
            <div className="relative rounded-[var(--hh-radius-lg)] overflow-hidden hh-tile transition-colors hover:border-[var(--hh-accent-line)]">
                {/* Jacket Image */}
                <div className="relative aspect-square overflow-hidden">
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
                                className="px-1.5 py-0.5 text-[10px] font-bold rounded-[var(--hh-radius-xs)] text-white"
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

                    {/* Constant Badge - bottom right. Opaque accent: the previous
                        /80 tint relied on a blur to stay readable on the jacket. */}
                    {constant !== undefined && (
                        <div className="hh-numeric absolute bottom-2 right-2 px-1.5 py-0.5 bg-miku rounded-[var(--hh-radius-xs)] text-[10px] text-white font-bold">
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
                                <span className="rounded-[var(--hh-radius-xs)] bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white">
                                    {t("common.badge.spoiler")}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="p-3">
                    <h3 className="text-sm hh-title font-bold text-[var(--hh-text-primary)] group-hover:text-miku">
                        <span className="flex flex-col">
                            <span className="block">{music.title}</span>
                            {translatedTitle && (
                                <span className="hh-body text-xs font-medium text-[var(--hh-text-tertiary)] block">{translatedTitle}</span>
                            )}
                        </span>
                    </h3>
                    <p className="hh-body text-xs text-[var(--hh-text-secondary)] mt-1">
                        {music.composer}
                        {music.composer !== music.arranger && music.arranger !== "-" && ` / ${music.arranger}`}
                    </p>
                    {showDifficulty && difficulties && (
                        <div className="flex justify-center gap-1 mt-1.5">
                            {ALL_DIFFICULTIES.map(diff => {
                                const level = difficulties[diff];
                                if (level === undefined) return null;
                                return (
                                    <span
                                        key={diff}
                                        className="hh-numeric text-[10px] font-bold text-white min-w-[1.25rem] text-center py-0.5 rounded-[var(--hh-radius-xs)]"
                                        style={{ backgroundColor: DIFFICULTY_COLORS[diff] }}
                                    >
                                        {level}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
