"use client";
import Image from "next/image";
import Link from "next/link";
import { IMusicInfo, getMusicJacketUrl, MUSIC_CATEGORY_NAMES, MUSIC_CATEGORY_COLORS, MusicCategoryType, MusicDifficultyType, DIFFICULTY_COLORS } from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";

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
    const { assetSource } = useTheme();
    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);

    return (
        <Link href={`/music/${music.id}`} className="group block" data-shortcut-item="true">
            <div className="relative rounded-xl overflow-hidden bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                {/* Jacket Image */}
                <div className="relative aspect-square overflow-hidden">
                    <Image
                        src={jacketUrl}
                        alt={music.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
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
                                {MUSIC_CATEGORY_NAMES[cat as MusicCategoryType]}
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
                            剧透
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="p-3">
                    <h3 className="text-sm font-bold text-primary-text group-hover:text-miku transition-colors">
                        <span className="flex flex-col">
                            <span className="block">{music.title}</span>
                            {cnTitle && (
                                <span className="text-xs font-medium text-slate-400 block">{cnTitle}</span>
                            )}
                        </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
