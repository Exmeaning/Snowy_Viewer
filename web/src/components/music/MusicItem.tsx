"use client";
import Image from "next/image";
import Link from "next/link";
import { IMusicInfo, getMusicJacketUrl, MUSIC_CATEGORY_COLORS, MusicCategoryType, MusicDifficultyType, DIFFICULTY_COLORS } from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { useTranslation } from "@/contexts/TranslationContext";

const ALL_DIFFICULTIES: MusicDifficultyType[] = ["easy", "normal", "hard", "expert", "master", "append"];

interface MusicItemProps {
    music: IMusicInfo;
    isSpoiler?: boolean;
    constant?: number;
    difficulties?: Record<string, number>;
    showDifficulty?: boolean;
    cnTitle?: string;
}

export default function MusicItem({ music, isSpoiler, constant, difficulties, showDifficulty, cnTitle }: MusicItemProps) {
    const { assetSource, useLLMTranslation } = useTheme();
    const { t } = useI18n();
    const { t: translateMasterText } = useTranslation();
    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);
    const translatedTitle = translateMasterText("music", "title", music.title) ?? (useLLMTranslation ? cnTitle : undefined);

    return (
        <Link href={`/music/${music.id}`} className="group pressable block" data-shortcut-item="true">
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
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-mono">
                        #{music.id}
                    </div>

                    {/* Constant Badge - bottom right */}
                    {constant !== undefined && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-miku/80 backdrop-blur-sm rounded text-[10px] text-white font-bold shadow-sm">
                            {constant.toFixed(1)}
                        </div>
                    )}

                    {/* Spoiler Badge - Top Left */}
                    {isSpoiler && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-orange-500 rounded text-[10px] text-white font-bold shadow">
                            {t("common.badge.spoiler")}
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
