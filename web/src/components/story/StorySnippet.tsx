"use client";
import { useState } from "react";
import Image from "next/image";
import { IProcessedAction, SnippetAction } from "@/types/story";
import { getCharacterIconUrl } from "@/lib/assets";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { UNIT_FIELD_TO_ID, UNIT_ICON_FILES } from "@/types/types";

interface TalkSnippetProps {
    characterId: number;
    characterName: string;
    text: string;
    voiceUrl?: string;
    cnText?: string;
    cnDisplayName?: string;
    translatedText?: string;
    translatedDisplayName?: string;
    translationSource?: 'official_cn' | 'llm' | 'human';
    unitName?: string; // Legacy unit name for virtual singers
    unitField?: string; // Unit field for virtual singers (e.g., 'light_sound', 'school_refusal')
    active?: boolean;
    progress?: number;
}

export function TalkSnippet({ 
    characterId, 
    characterName, 
    text, 
    voiceUrl, 
    cnText, 
    cnDisplayName, 
    translatedText,
    translatedDisplayName,
    translationSource: _translationSource, 
    unitName: _unitName, 
    unitField,
    active = false,
    progress = 0
}: TalkSnippetProps) {
    const { useLLMTranslation } = useTheme();
    const iconUrl = characterId > 0 && characterId <= 26
        ? getCharacterIconUrl(characterId)
        : null;

    // Show CN text when translation is enabled and different from original (after trimming)
    const showCnText = useLLMTranslation && !!cnText && cnText.trim() !== text.trim();
    // Show CN display name when translation is enabled, available, and different from original (after trimming)
    const showCnDisplayName = useLLMTranslation && !!cnDisplayName && cnDisplayName.trim() !== characterName.trim();
    const displayTranslation = translatedText ?? cnText;
    const displayNameTranslation = translatedDisplayName ?? cnDisplayName;
    const showTranslatedText = translatedText !== undefined
        ? useLLMTranslation && !!translatedText && translatedText.trim() !== text.trim()
        : showCnText;
    const showTranslatedDisplayName = translatedDisplayName !== undefined
        ? useLLMTranslation && !!translatedDisplayName && translatedDisplayName.trim() !== characterName.trim()
        : showCnDisplayName;

    // Determine badge unit icon for virtual singers (21-26)
    const isVirtualSinger = characterId >= 21 && characterId <= 26;
    let badgeUnitId: string | null = null;
    if (isVirtualSinger && unitField && unitField !== "piapro") {
        // Directly use UNIT_FIELD_TO_ID to get the unit id
        badgeUnitId = UNIT_FIELD_TO_ID[unitField] || null;
    }
    const badgeIcon = badgeUnitId ? UNIT_ICON_FILES[badgeUnitId] : null;

    return (
        <div
            // A dialogue box is an opaque slab with a hairline border, not a
            // translucent bubble. The active line is marked by an accent border
            // and a raise rather than a ring + scale, so the reading column never
            // shifts width while autoplay walks down it.
            className={`rounded-[var(--hh-radius-lg)] p-4 my-3 relative overflow-hidden bg-[var(--hh-surface-2)] border transition-colors duration-200 ${
                active
                    ? "border-[var(--hh-accent)] shadow-[var(--hh-shadow-raised)] z-10"
                    : "border-[var(--hh-border)] shadow-[var(--hh-shadow-tile)]"
            }`}
        >
            {/* Playback progress rail for the line currently being voiced. */}
            {active && (
                <div
                    className="absolute top-0 left-0 h-[3px] bg-[var(--hh-accent)] transition-all duration-100"
                    style={{ width: `${progress}%` }}
                />
            )}
            <div className="flex items-start gap-3">
                {/* Character Avatar */}
                <div className="shrink-0 relative">
                    {iconUrl ? (
                        <>
                            <img
                                src={iconUrl}
                                alt={characterName}
                                className="w-12 h-12 rounded-[var(--hh-radius-full)] object-cover bg-[var(--hh-surface-sunken)] border-2 border-[var(--hh-accent-line)]"
                            />
                            {badgeIcon && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-2)] border border-[var(--hh-border)] flex items-center justify-center">
                                    <Image
                                        src={`/data/icon/${badgeIcon}`}
                                        alt=""
                                        width={16}
                                        height={16}
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-12 h-12 rounded-[var(--hh-radius-full)] bg-[var(--hh-surface-inset)] flex items-center justify-center border-2 border-[var(--hh-border-strong)]">
                            <span className="text-[var(--hh-text-secondary)] text-sm font-bold">
                                {characterName.charAt(0)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Character Name Badge */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="hh-chip hh-chip-active">
                            {characterName}
                        </span>
                        {showTranslatedDisplayName && (
                            <span className="hh-chip">
                                {displayNameTranslation}
                            </span>
                        )}
                    </div>

                    {/* Dialogue Text */}
                    <p className="hh-body text-[var(--hh-text-primary)] text-base whitespace-pre-wrap">
                        {text}
                    </p>

                    {/* Translated line, separated from the source by a hairline. */}
                    {showTranslatedText && (
                        <p className="hh-body text-[var(--hh-text-secondary)] text-sm whitespace-pre-wrap mt-1.5 pt-1.5 border-t border-[var(--hh-border)]">
                            {displayTranslation}
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

/* Directive tag shared by every special-effect marker.
   The hue identifies the directive type and is carried by the border and the
   tint only — deliberately not by the text color. Two reasons: handheld-os.css
   is imported unlayered so .hh-label's `color` would beat any Tailwind
   `text-*` on the same element, and `dark:` here resolves to
   prefers-color-scheme rather than this app's [data-theme] attribute, so a
   hue/dark-hue text pair would desync from a manually chosen theme. Keeping
   text on --hh-text-secondary lets the theme own legibility while the hue
   still reads at a glance. */
const SE_TAG = "hh-label px-2 py-0.5 rounded-[var(--hh-radius-sm)] border";

// Helper function to check if a background is a CG
function isCgImage(picName: string): boolean {
    if (picName.startsWith('bg_a')) {
        const numPart = picName.substring(4);
        const num = parseInt(numPart, 10);
        return !isNaN(num) && num >= 1 && num <= 99;
    }
    return picName.startsWith('bg_s');
}

export function SpecialEffectSnippet({ seType, text, resource }: SpecialEffectSnippetProps) {
    const [isImageOpen, setIsImageOpen] = useState(false);
    const { t } = useI18n();

    switch (seType) {
        case "FullScreenText":
            // In-game this is white text on a blacked-out screen, so the dark
            // slab is content, not theming — it stays dark in light mode too and
            // the hardcoded ink is what keeps the white text legible.
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-6 my-4 border border-[#3a3b41] bg-[#1c1d21] relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={SE_TAG + " border-purple-400/45 bg-purple-400/15 !text-[#d6bcfa]"}>
                            {t("page.story.snippet.fullScreenText")}
                        </span>
                    </div>
                    <p className="hh-body text-white text-lg sm:text-xl text-center whitespace-pre-wrap my-4">
                        {text?.trimStart()}
                    </p>
                    {resource && (
                        <div className="flex justify-center mt-3">
                            <AudioPlayButton url={resource} className="bg-purple-400/15 text-purple-300 border border-purple-400/40 hover:bg-purple-400/25" />
                        </div>
                    )}
                </div>
            );

        case "Telop":
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-4 my-3 border border-[var(--hh-border)] border-l-4 border-l-amber-500 bg-[var(--hh-surface-1)]">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={SE_TAG + " border-amber-500/45 bg-amber-500/15"}>
                            {t("page.story.snippet.telop")}
                        </span>
                    </div>
                    <p className="hh-body text-[var(--hh-text-primary)] text-base text-center font-medium whitespace-pre-wrap">
                        {text?.trimStart()}
                    </p>
                </div>
            );

        case "PlaceInfo":
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-4 my-3 border border-[var(--hh-border)] border-l-4 border-l-blue-500 bg-[var(--hh-surface-1)]">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={SE_TAG + " border-blue-500/45 bg-blue-500/15"}>
                            {t("page.story.snippet.placeInfo")}
                        </span>
                    </div>
                    <p className="hh-body text-[var(--hh-text-primary)] text-base font-medium">
                        {t("page.story.snippet.placeText", { place: text })}
                    </p>
                </div>
            );

        case "ChangeBackground":
            //case "ChangeBackgroundStill":
            const isCg = isCgImage(text || '');
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-4 my-3 border border-[var(--hh-border)] border-l-4 border-l-emerald-500 bg-[var(--hh-surface-1)]">
                    <div className="flex items-center gap-2 mb-3">
                        <span className={SE_TAG + " border-emerald-500/45 bg-emerald-500/15"}>
                            {isCg ? t("page.story.snippet.cgInsert") : t("page.story.snippet.backgroundChange")}
                        </span>
                    </div>

                    {isImageOpen && resource ? (
                        <div
                            className="cursor-pointer overflow-hidden rounded-[var(--hh-radius-md)] border border-[var(--hh-border)]"
                            // Opens the full-size art in a new tab — an outbound jump,
                            // which is the same cue a real link would get.
                            data-hh-click
                            data-hh-sound="confirm"
                            onClick={() => window.open(resource, "_blank")}
                        >
                            <img
                                src={resource}
                                alt="Background"
                                className="w-full"
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsImageOpen(true)}
                            className="hh-btn hh-press px-4 py-2 text-sm"
                        >
                            {isCg ? t("page.story.snippet.showCg") : t("page.story.snippet.showBackground")}
                        </button>
                    )}
                </div>
            );

        case "FlashbackIn":
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-3 my-3 border border-[var(--hh-border)] border-l-4 border-l-yellow-500 bg-[var(--hh-surface-1)]">
                    <div className="flex items-center gap-2">
                        <span className={SE_TAG + " border-yellow-500/45 bg-yellow-500/15"}>
                            {t("page.story.snippet.flashbackIn")}
                        </span>
                    </div>
                </div>
            );

        case "FlashbackOut":
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-3 my-3 border border-[var(--hh-border)] border-l-4 border-l-yellow-500 bg-[var(--hh-surface-1)]">
                    <div className="flex items-center gap-2">
                        <span className={SE_TAG + " border-yellow-500/45 bg-yellow-500/15"}>
                            {t("page.story.snippet.flashbackOut")}
                        </span>
                    </div>
                </div>
            );

        case "BlackOut":
            // Blackout/whiteout keep literal ink so the marker still depicts the
            // screen transition it stands for, in either theme.
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-3 my-3 border border-[#3a3b41] bg-[#1c1d21]">
                    <div className="flex items-center gap-2">
                        <span className={SE_TAG + " border-white/20 bg-white/10 !text-[#c9ccd2]"}>
                            {t("page.story.snippet.blackOut")}
                        </span>
                    </div>
                </div>
            );

        case "WhiteOut":
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-3 my-3 border border-[#d6d8dd] bg-[#f7f7f9]">
                    <div className="flex items-center gap-2">
                        <span className={SE_TAG + " border-black/15 bg-black/5 !text-[#5c5f66]"}>
                            {t("page.story.snippet.whiteOut")}
                        </span>
                    </div>
                </div>
            );

        case "SimpleSelectable":
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-4 my-3 border border-[var(--hh-border)] border-l-4 border-l-indigo-500 bg-[var(--hh-surface-1)]">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={SE_TAG + " border-indigo-500/45 bg-indigo-500/15"}>
                            {t("page.story.snippet.choice")}
                        </span>
                    </div>
                    <p className="hh-body text-[var(--hh-text-primary)] text-base text-center font-medium whitespace-pre-wrap">
                        {text?.trimStart()}
                    </p>
                </div>
            );

        case "Movie":
            return (
                <div className="rounded-[var(--hh-radius-lg)] p-4 my-3 border border-[var(--hh-border)] border-l-4 border-l-red-500 bg-[var(--hh-surface-1)]">
                    <div className="flex items-center gap-2">
                        <span className={SE_TAG + " border-red-500/45 bg-red-500/15"}>
                            {t("page.story.snippet.movie")}
                        </span>
                        <span className="text-[var(--hh-text-primary)] text-sm font-medium">{text}</span>
                    </div>
                </div>
            );

        case "PlayMV":
            // resource format: "id:name" or just "id"
            const mvParts = resource?.split(':') || [];
            const mvId = mvParts[0] || '';
            const mvName = mvParts[1] || '';

            return (
                <div className="rounded-[var(--hh-radius-lg)] p-4 my-3 border border-[var(--hh-border)] border-l-4 border-l-purple-500 bg-[var(--hh-surface-1)]">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className={SE_TAG + " border-purple-500/45 bg-purple-500/15"}>
                                {t("page.story.snippet.playMv")}
                            </span>
                        </div>
                        {mvName ? (
                            <p className="hh-title text-[var(--hh-text-primary)] text-base">{mvName}</p>
                        ) : (
                            <p className="hh-numeric text-[var(--hh-text-secondary)] text-sm font-medium">MV ID: {mvId}</p>
                        )}
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
    const { t } = useI18n();

    return (
        <div className="hh-well p-3 my-2">
            <div className="flex items-center gap-3">
                <span className={`${SE_TAG} ${hasBgm
                    ? "border-green-500/45 bg-green-500/15"
                    : "border-orange-500/45 bg-orange-500/15"
                    }`}>
                    {hasBgm ? "BGM" : hasSe ? "SE" : t("page.story.snippet.soundEffect")}
                </span>

                {isNoSound ? (
                    <span className="text-[var(--hh-text-tertiary)] text-sm">{t("page.story.snippet.silent")}</span>
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
    const { t } = useI18n();

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

    // Callers may pass a themed skin (the blacked-out FullScreenText slide does).
    // Tailwind utilities of equal specificity resolve by stylesheet order rather
    // than by class-string order, so the default skin is omitted entirely when a
    // caller supplies one instead of relying on the override winning.
    const idleSkin = className
        ? className
        : "bg-[var(--hh-surface-2)] border border-[var(--hh-border)] text-[var(--hh-text-secondary)]";

    return (
        <button
            onClick={handlePlay}
            className={`hh-press p-2 rounded-[var(--hh-radius-full)] ${isPlaying
                ? "bg-[var(--hh-accent)] border border-[var(--hh-accent-deep)] text-[var(--hh-text-on-accent)]"
                : idleSkin
                }`}
            title={isPlaying ? t("page.story.snippet.stopAudio") : t("page.story.snippet.playAudio")}
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
    index?: number;
    activeIndex?: number;
    playbackProgress?: number;
}

export function StorySnippet({ action, index, activeIndex, playbackProgress }: StorySnippetProps) {
    const active = index !== undefined && activeIndex !== undefined && index === activeIndex;
    
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
                    translatedText={action.translatedBody}
                    translatedDisplayName={action.translatedDisplayName}
                    translationSource={action.translationSource}
                    unitName={action.chara?.unitName}
                    unitField={action.chara?.unitField}
                    active={active}
                    progress={playbackProgress}
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
