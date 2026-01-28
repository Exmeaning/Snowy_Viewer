"use client";
import { useState } from "react";
import { IProcessedAction, SnippetAction } from "@/types/story";
import { getCharacterIconUrl } from "@/lib/assets";
import { useTheme } from "@/contexts/ThemeContext";

interface TalkSnippetProps {
    characterId: number;
    characterName: string;
    text: string;
    voiceUrl?: string;
    cnText?: string;
    cnDisplayName?: string;
    translationSource?: 'official_cn' | 'llm';
}

export function TalkSnippet({ characterId, characterName, text, voiceUrl, cnText, cnDisplayName, translationSource }: TalkSnippetProps) {
    const { useLLMTranslation } = useTheme();
    const iconUrl = characterId > 0 && characterId <= 26
        ? getCharacterIconUrl(characterId)
        : null;

    // Use CN display name when translation is enabled and available
    const displayName = (useLLMTranslation && cnDisplayName) ? cnDisplayName : characterName;
    // Show CN text when translation is enabled
    const showCnText = useLLMTranslation && !!cnText;

    return (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-4 my-3 shadow-sm border border-slate-200/50 dark:border-slate-700/50 relative">
            <div className="flex items-start gap-3">
                {/* Character Avatar */}
                <div className="shrink-0">
                    {iconUrl ? (
                        <img
                            src={iconUrl}
                            alt={characterName}
                            className="w-12 h-12 rounded-full object-cover bg-slate-100 dark:bg-slate-700 border-2 border-miku/30"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600">
                            <span className="text-white text-sm font-bold">
                                {displayName.charAt(0)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Character Name Badge */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block px-2.5 py-0.5 bg-miku/10 text-miku text-sm font-medium rounded-full border border-miku/20">
                            {displayName}
                        </span>
                    </div>

                    {/* Dialogue Text */}
                    <p className="text-primary-text text-base leading-relaxed whitespace-pre-wrap">
                        {text}
                    </p>

                    {/* CN Translation */}
                    {showCnText && (
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                            {cnText}
                        </p>
                    )}
                </div>

                {/* Voice Button */}
                {voiceUrl && (
                    <AudioPlayButton url={voiceUrl} />
                )}
            </div>
        </div>
    );
}

interface SpecialEffectSnippetProps {
    seType: string;
    text?: string;
    resource?: string;
}

export function SpecialEffectSnippet({ seType, text, resource }: SpecialEffectSnippetProps) {
    const [isImageOpen, setIsImageOpen] = useState(false);

    switch (seType) {
        case "FullScreenText":
            return (
                <div className="bg-slate-900/90 dark:bg-slate-950/90 rounded-xl p-6 my-4 shadow-lg border border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                            全屏文字
                        </span>
                    </div>
                    <p className="text-white text-lg leading-relaxed text-center whitespace-pre-wrap">
                        {text?.trimStart()}
                    </p>
                    {resource && <AudioPlayButton url={resource} className="mt-3" />}
                </div>
            );

        case "Telop":
            return (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-4 my-3 border border-amber-200 dark:border-amber-700">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-full">
                            字幕
                        </span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-200 text-base leading-relaxed text-center whitespace-pre-wrap">
                        {text?.trimStart()}
                    </p>
                </div>
            );

        case "ChangeBackground":
            return (
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 my-3 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">
                            场景切换
                        </span>
                    </div>

                    {isImageOpen && resource ? (
                        <div
                            className="cursor-pointer"
                            onClick={() => window.open(resource, "_blank")}
                        >
                            <img
                                src={resource}
                                alt="Background"
                                className="w-full rounded-lg shadow-md hover:opacity-90 transition-opacity"
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsImageOpen(true)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            显示背景
                        </button>
                    )}
                </div>
            );

        case "Movie":
            return (
                <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 my-3 border border-slate-700">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                            视频
                        </span>
                        <span className="text-slate-400 text-sm">{text}</span>
                    </div>
                </div>
            );

        default:
            return null;
    }
}

interface SoundSnippetProps {
    hasBgm: boolean;
    hasSe: boolean;
    audioUrl?: string;
}

export function SoundSnippet({ hasBgm, hasSe, audioUrl }: SoundSnippetProps) {
    const isNoSound = audioUrl?.endsWith("bgm00000.mp3");

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 my-2 border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${hasBgm
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                    }`}>
                    {hasBgm ? "BGM" : hasSe ? "SE" : "音效"}
                </span>

                {isNoSound ? (
                    <span className="text-slate-400 text-sm">静音</span>
                ) : audioUrl ? (
                    <AudioPlayButton url={audioUrl} />
                ) : null}
            </div>
        </div>
    );
}

// Simple audio play button component
interface AudioPlayButtonProps {
    url: string;
    className?: string;
}

function AudioPlayButton({ url, className = "" }: AudioPlayButtonProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

    const handlePlay = () => {
        if (isPlaying && audio) {
            audio.pause();
            setIsPlaying(false);
            return;
        }

        const newAudio = new Audio(url);
        newAudio.onended = () => setIsPlaying(false);
        newAudio.onerror = () => setIsPlaying(false);
        newAudio.play().catch(() => setIsPlaying(false));
        setAudio(newAudio);
        setIsPlaying(true);
    };

    return (
        <button
            onClick={handlePlay}
            className={`p-2 rounded-full transition-colors ${isPlaying
                ? "bg-miku/20 text-miku"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-miku/10 hover:text-miku"
                } ${className}`}
            title={isPlaying ? "停止" : "播放"}
        >
            {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
            ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5.14v14l11-7-11-7z" />
                </svg>
            )}
        </button>
    );
}

// Main snippet renderer
interface StorySnippetProps {
    action: IProcessedAction;
}

export function StorySnippet({ action }: StorySnippetProps) {
    switch (action.type) {
        case SnippetAction.Talk:
            return (
                <TalkSnippet
                    characterId={action.chara?.id || 0}
                    characterName={action.chara?.name || "???"}
                    text={action.body || ""}
                    voiceUrl={action.voice}
                    cnText={action.cnBody}
                    cnDisplayName={action.cnDisplayName}
                    translationSource={action.translationSource}
                />
            );

        case SnippetAction.SpecialEffect:
            return (
                <SpecialEffectSnippet
                    seType={action.seType || ""}
                    text={action.body}
                    resource={action.resource}
                />
            );

        case SnippetAction.Sound:
            return (
                <SoundSnippet
                    hasBgm={action.hasBgm || false}
                    hasSe={action.hasSe || false}
                    audioUrl={action.hasBgm ? action.bgm : action.se}
                />
            );

        default:
            return null;
    }
}

export default StorySnippet;
