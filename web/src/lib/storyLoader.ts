/**
 * Story Loader - Fetches and processes scenario data for display
 */

import {
    IScenarioData,
    ICharacter2D,
    IMobCharacter,
    IProcessedScenarioData,
    IProcessedAction,
    SnippetAction,
    SpecialEffectType,
    SoundPlayMode,
    SnippetProgressBehavior,
} from "@/types/story";
import { fetchMasterData } from "./fetch";
import { getBackgroundImageUrl, getStoryVoiceUrl, getCardStoryVoiceUrl, getAreaTalkVoiceUrl, getSpecialStoryVoiceUrl, getStoryBgmUrl, getStorySoundEffectUrl } from "./assets";
import type { AssetSourceType } from "@/contexts/ThemeContext";
import { CHAR_NAMES, UNIT_NAME_MAP } from "@/types/types";
import { IGameChara, IUnitProfile } from "@/types/types";

// MV names mapping (ID 1-5 for unit main stories)
const MV_NAMES: Record<number, { jp: string; cn: string }> = {
    1: { jp: "needLe", cn: "needLe" },
    2: { jp: "アイドル新鋭隊", cn: "偶像新锐队" },
    3: { jp: "Ready Steady", cn: "Ready Steady" },
    4: { jp: "セカイはまだ始まってすらいない", cn: "世界还未开始" },
    5: { jp: "悔やむと書いてミライ", cn: "写作悔恨的未来" },
};

/**
 * Fetch scenario JSON data from the provided URL
 */
export async function fetchScenarioData(scenarioUrl: string): Promise<IScenarioData> {
    const response = await fetch(scenarioUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch scenario: ${response.status}`);
    }
    return response.json();
}

/**
 * Get character name from character2d ID
 * Returns character info with unit annotation for virtual singers
 */
async function getCharacterName(
    character2dId: number,
    character2ds: ICharacter2D[],
    mobCharacters: IMobCharacter[],
    _unitProfiles: IUnitProfile[]
): Promise<{ id: number; name: string; unitName?: string; unitField?: string }> {
    const chara2d = character2ds.find((c) => c.id === character2dId);

    if (!chara2d) {
        return { id: 0, name: "???" };
    }

    if (chara2d.characterType === "game_character") {
        const name = CHAR_NAMES[chara2d.characterId] || `Character ${chara2d.characterId}`;
        
        // Check if this is a virtual singer (characterId 21-26)
        const isVirtualSinger = chara2d.characterId >= 21 && chara2d.characterId <= 26;
        
        // If it's a virtual singer and has a specific unit, use UNIT_NAME_MAP for consistency
        if (isVirtualSinger && chara2d.unit && chara2d.unit !== "piapro" && chara2d.unit !== "none") {
            const unitName = UNIT_NAME_MAP[chara2d.unit];
            if (unitName) {
                return { id: chara2d.characterId, name, unitName, unitField: chara2d.unit };
            }
        }
        
        return { id: chara2d.characterId, name };
    }

    if (chara2d.characterType === "mob") {
        const mob = mobCharacters.find((m) => m.id === chara2d.characterId);
        return { id: chara2d.characterId, name: mob?.name || "Mob" };
    }

    return { id: 0, name: "???" };
}

/**
 * Get scenarioId from the full scenario URL or the scenario data
 */
function extractScenarioIdFromData(data: IScenarioData): string {
    return data.ScenarioId;
}

/**
 * Process scenario data into a format suitable for display
 * @param storyType - "card" | "talk" | "special" | "scenario" (default). Determines voice URL path.
 * @param source - Asset source for voice/background URLs.
 * @param serverSource - Server source (jp/cn) for localized MV names.
 */
export async function processScenarioForDisplay(
    data: IScenarioData,
    storyType: "card" | "talk" | "special" | "scenario" = "scenario",
    source: AssetSourceType = "uni",
    serverSource: "jp" | "cn" = "jp"
): Promise<IProcessedScenarioData> {
    // Fetch required master data
    const [character2ds, mobCharacters, _gameCharacters, unitProfiles] = await Promise.all([
        fetchMasterData<ICharacter2D[]>("character2ds.json").catch(() => []),
        fetchMasterData<IMobCharacter[]>("mobCharacters.json").catch(() => []),
        fetchMasterData<IGameChara[]>("gameCharacters.json").catch(() => []),
        fetchMasterData<IUnitProfile[]>("unitProfiles.json").catch(() => []),
    ]);

    const scenarioId = extractScenarioIdFromData(data);
    const actions: IProcessedAction[] = [];
    const characters: { id: number; name: string }[] = [];

    // Process appear characters - only add game_character types
    // Note: We only collect characterId here, not character2d unit info
    const characterIdSet = new Set<number>();
    for (const appearChar of data.AppearCharacters) {
        const chara2d = character2ds.find((c) => c.id === appearChar.Character2dId);
        if (chara2d && chara2d.characterType === "game_character") {
            const charId = chara2d.characterId;
            if (!characterIdSet.has(charId)) {
                characterIdSet.add(charId);
                const charName = CHAR_NAMES[charId] || `Character ${charId}`;
                characters.push({ id: charId, name: charName });
            }
        }
    }
    
    // Sort characters by ID
    characters.sort((a, b) => a.id - b.id);

    // Add first background if exists
    if (data.FirstBackground) {
        actions.push({
            type: SnippetAction.SpecialEffect,
            delay: 0,
            isWait: true,
            seType: "ChangeBackground",
            resource: getBackgroundImageUrl(data.FirstBackground, source),
            body: data.FirstBackground,
        });
    }

    // Add first BGM if exists
    if (data.FirstBgm && data.FirstBgm !== "bgm00000") {
        actions.push({
            type: SnippetAction.Sound,
            delay: 0,
            isWait: true,
            hasBgm: true,
            hasSe: false,
            bgm: getStoryBgmUrl(data.FirstBgm, source),
            playMode: "CrossFade",
        });
    }

    // Process snippets
    for (const snippet of data.Snippets) {
        const isWait = snippet.ProgressBehavior === SnippetProgressBehavior.WaitUnitilFinished;

        switch (snippet.Action) {
            case SnippetAction.Talk: {
                const talkData = data.TalkData[snippet.ReferenceIndex];
                if (!talkData) continue;

                const character2dId = talkData.TalkCharacters[0]?.Character2dId || 0;
                const charInfo = character2dId
                    ? await getCharacterName(character2dId, character2ds, mobCharacters, unitProfiles)
                    : { id: 0, name: talkData.WindowDisplayName };

                // Use WindowDisplayName if it differs from resolved name (for mobs/custom names)
                const displayName = talkData.WindowDisplayName || charInfo.name;

                // Get voice URL if exists
                let voiceUrl = "";
                if (talkData.Voices?.length > 0) {
                    const voice = talkData.Voices[0];
                    // partvoice_* are part-song voices with complex URL rules, skip for now
                    if (!voice.VoiceId.startsWith("partvoice")) {
                        if (storyType === "card") {
                            voiceUrl = getCardStoryVoiceUrl(scenarioId, voice.VoiceId, source);
                        } else if (storyType === "talk") {
                            voiceUrl = getAreaTalkVoiceUrl(scenarioId, voice.VoiceId, source);
                        } else if (storyType === "special") {
                            voiceUrl = getSpecialStoryVoiceUrl(scenarioId, voice.VoiceId, source);
                        } else {
                            voiceUrl = getStoryVoiceUrl(scenarioId, voice.VoiceId, source);
                        }
                    }
                }

                actions.push({
                    type: SnippetAction.Talk,
                    delay: snippet.Delay,
                    isWait,
                    chara: { 
                        id: charInfo.id, 
                        name: displayName, 
                        unitName: charInfo.unitName,
                        unitField: charInfo.unitField 
                    },
                    body: talkData.Body,
                    voice: voiceUrl,
                });
                break;
            }

            case SnippetAction.SpecialEffect: {
                const seData = data.SpecialEffectData[snippet.ReferenceIndex];
                if (!seData) continue;

                const effectTypeName = SpecialEffectType[seData.EffectType] || "Unknown";

                let resource = "";
                if (
                    seData.EffectType === SpecialEffectType.ChangeBackground ||
                    seData.EffectType === SpecialEffectType.ChangeBackgroundStill
                ) {
                    resource = getBackgroundImageUrl(seData.StringValSub || seData.StringVal, source);
                } else if (seData.EffectType === SpecialEffectType.FullScreenText) {
                    // Voice for fullscreen text
                    if (seData.StringValSub) {
                        resource = getStoryVoiceUrl(scenarioId, seData.StringValSub, source);
                    }
                } else if (seData.EffectType === SpecialEffectType.PlayMV) {
                    // For PlayMV, IntVal contains the music video ID
                    const mvId = seData.IntVal;
                    if (mvId && MV_NAMES[mvId]) {
                        // Use localized MV name based on server source
                        const mvName = serverSource === "cn" ? MV_NAMES[mvId].cn : MV_NAMES[mvId].jp;
                        resource = `${mvId}:${mvName}`;
                    } else {
                        resource = mvId?.toString() || "";
                    }
                }

                actions.push({
                    type: SnippetAction.SpecialEffect,
                    delay: snippet.Delay,
                    isWait,
                    seType: effectTypeName,
                    body: seData.StringVal,
                    resource,
                });
                break;
            }

            case SnippetAction.Sound: {
                const soundData = data.SoundData[snippet.ReferenceIndex];
                if (!soundData) continue;

                actions.push({
                    type: SnippetAction.Sound,
                    delay: snippet.Delay,
                    isWait,
                    hasBgm: !!soundData.Bgm,
                    hasSe: !!soundData.Se,
                    bgm: soundData.Bgm ? getStoryBgmUrl(soundData.Bgm, source) : "",
                    se: soundData.Se ? getStorySoundEffectUrl(soundData.Se, source) : "",
                    playMode: SoundPlayMode[soundData.PlayMode] || "CrossFade",
                });
                break;
            }

            // Skip other action types for now (CharacterLayout, CharacterMotion, Camera, etc.)
            default:
                break;
        }
    }

    return { characters, actions };
}

/**
 * Merge CN translations into processed actions
 * For each Talk action, looks up the CN translation for body and display name
 * 
 * @param actions - The processed actions from JP scenario
 * @param translation - The event story translation data (or null if not available)
 * @param episodeNo - The episode number to look up
 * @returns Actions with CN translation fields populated
 */
import { IEventStoryTranslation, getStoryTranslation } from "./eventStoryTranslation";

export function mergeTranslations(
    actions: IProcessedAction[],
    translation: IEventStoryTranslation | null,
    episodeNo: number
): IProcessedAction[] {
    if (!translation) return actions;

    const episodeTranslation = getStoryTranslation(translation, episodeNo);
    if (!episodeTranslation) return actions;

    return actions.map(action => {
        if (action.type === SnippetAction.Talk && action.body) {
            // Find translation for body
            const cnBody = episodeTranslation.talkData[action.body];

            // Find translation for Display Name
            const cnDisplayName = action.chara?.name
                ? episodeTranslation.talkData[action.chara.name]
                : undefined;

            if (cnBody || cnDisplayName) {
                return {
                    ...action,
                    cnBody,
                    cnDisplayName: cnDisplayName || action.chara?.name,
                    translationSource: translation.meta?.source
                };
            }
        }
        return action;
    });
}

export function mergeStoryTitle(
    originalTitle: string,
    translation: IEventStoryTranslation | null,
    episodeNo: number
): string {
    if (!translation) return originalTitle;
    const episodeTranslation = getStoryTranslation(translation, episodeNo);
    return episodeTranslation?.title || originalTitle;
}
