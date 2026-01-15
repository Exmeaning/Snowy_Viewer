"use client";
import Image from "next/image";
import Link from "next/link";
import { IMusicInfo, getMusicJacketUrl, MUSIC_CATEGORY_NAMES, MUSIC_CATEGORY_COLORS, MusicCategoryType } from "@/types/music";
import { useTheme } from "@/contexts/ThemeContext";

interface MusicItemProps {
    music: IMusicInfo;
    isSpoiler?: boolean;
}

export default function MusicItem({ music, isSpoiler }: MusicItemProps) {
    const { assetSource } = useTheme();
    const jacketUrl = getMusicJacketUrl(music.assetbundleName, assetSource);

    return (
        <Link href={`/music/${music.id}`} className="group block">
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
                        {music.categories.map((cat) => (
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

                    {/* Spoiler Badge - Top Left */}
                    {isSpoiler && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-orange-500 rounded text-[10px] text-white font-bold shadow">
                            剧透
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="p-3">
                    <h3 className="text-sm font-bold text-primary-text truncate group-hover:text-miku transition-colors">
                        {music.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                        {music.composer}
                        {music.composer !== music.arranger && music.arranger !== "-" && ` / ${music.arranger}`}
                    </p>
                </div>
            </div>
        </Link>
    );
}
