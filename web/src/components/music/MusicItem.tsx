"use client";
import Image from "next/image";
import Link from "@/components/LocalizedLink";
import { IMusicInfo, getMusicJacketUrl, MUSIC_CATEGORY_COLORS, MusicCategoryType, MusicDifficultyType, DIFFICULTY_COLORS } from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTranslation } from "@/contexts/TranslationContext";

const ALL_DIFFICULTIES: MusicDifficultyType[] = ["easy", "normal", "hard", "expert", "master", "append"];
const JACKET_OVERLAY_BADGE_CLASS = "inline-flex h-5 items-center rounded bg-black/60 px-1.5 font-mono text-[10px] font-normal leading-4 text-white shadow-sm backdrop-blur-sm";

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
        <Link href={itemHref} className="group pressable block [content-visibility:auto] [contain-intrinsic-size:auto_320px]" data-shortcut-item="true">
            <div className="relative rounded-xl overflow-hidden ios-glass-card ios-glass-card-interactive">
                {/* Jacket Image */}
                <div className="relative aspect-square overflow-hidden">
                    <Image
                        src={jacketUrl}
                        alt={music.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-soft)]"
                        unoptimized
                        loading="lazy"
                        decoding="async"
                    />

                    {/* Category Tags Overlay */}
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                        {Array.from(new Set(music.categories)).map((cat) => (
                            <span
                                key={cat}
                                className="px-1.5 py-0.5 text-[10px] font-bold rounded text-white shadow-sm"
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
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-miku/80 backdrop-blur-sm rounded text-[10px] text-white font-bold shadow-sm">
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
                                <span className="rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-4 text-white shadow-sm">
                                    {t("common.badge.spoiler")}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="p-3">
                    <h3 className="text-sm type-title font-bold text-primary-text group-hover:text-miku">
                        <span className="flex flex-col">
                            <span className="block">{music.title}</span>
                            {translatedTitle && (
                                <span className="text-xs type-caption font-medium text-slate-400 block">{translatedTitle}</span>
                            )}
                        </span>
                    </h3>
                    <p className="text-xs type-caption text-slate-500 dark:text-slate-400 mt-1">
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
                                        className="text-[10px] font-bold text-white min-w-[1.25rem] text-center py-0.5 rounded"
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
