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
import { getBackgroundImageUrl, getStoryVoiceUrl, getStoryBgmUrl, getStorySoundEffectUrl } from "./assets";
import { CHAR_NAMES } from "@/types/types";

// Asset base URL for direct scenario fetching
const SCENARIO_BASE_URL = "https://assets.unipjsk.com/ondemand";

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
 */
function getCharacterName(
    character2dId: number,
    character2ds: ICharacter2D[],
    mobCharacters: IMobCharacter[]
): { id: number; name: string } {
    const chara2d = character2ds.find((c) => c.id === character2dId);

    if (!chara2d) {
        return { id: 0, name: "???" };
    }

    if (chara2d.characterType === "game_character") {
        const name = CHAR_NAMES[chara2d.characterId] || `Character ${chara2d.characterId}`;
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
 */
export async function processScenarioForDisplay(
    data: IScenarioData
): Promise<IProcessedScenarioData> {
    // Fetch required master data
    const [character2ds, mobCharacters] = await Promise.all([
        fetchMasterData<ICharacter2D[]>("character2ds.json").catch(() => []),
        fetchMasterData<IMobCharacter[]>("mobCharacters.json").catch(() => []),
    ]);

    const scenarioId = extractScenarioIdFromData(data);
    const actions: IProcessedAction[] = [];
    const characters: { id: number; name: string }[] = [];

    // Process appear characters
    for (const appearChar of data.AppearCharacters) {
        const charInfo = getCharacterName(appearChar.Character2dId, character2ds, mobCharacters);
        if (!characters.some((c) => c.id === charInfo.id)) {
            characters.push(charInfo);
        }
    }

    // Add first background if exists
    if (data.FirstBackground) {
        actions.push({
            type: SnippetAction.SpecialEffect,
            delay: 0,
            isWait: true,
            seType: "ChangeBackground",
            resource: getBackgroundImageUrl(data.FirstBackground),
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
            bgm: getStoryBgmUrl(data.FirstBgm),
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
                    ? getCharacterName(character2dId, character2ds, mobCharacters)
                    : { id: 0, name: talkData.WindowDisplayName };

                // Use WindowDisplayName if it differs from resolved name (for mobs/custom names)
                const displayName = talkData.WindowDisplayName || charInfo.name;

                // Get voice URL if exists
                let voiceUrl = "";
                if (talkData.Voices?.length > 0) {
                    const voice = talkData.Voices[0];
                    voiceUrl = getStoryVoiceUrl(scenarioId, voice.VoiceId);
                }

                actions.push({
                    type: SnippetAction.Talk,
                    delay: snippet.Delay,
                    isWait,
                    chara: { id: charInfo.id, name: displayName },
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
                if (seData.EffectType === SpecialEffectType.ChangeBackground) {
                    resource = getBackgroundImageUrl(seData.StringValSub || seData.StringVal);
                } else if (seData.EffectType === SpecialEffectType.FullScreenText) {
                    // Voice for fullscreen text
                    if (seData.StringValSub) {
                        resource = getStoryVoiceUrl(scenarioId, seData.StringValSub);
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
                    bgm: soundData.Bgm ? getStoryBgmUrl(soundData.Bgm) : "",
                    se: soundData.Se ? getStorySoundEffectUrl(soundData.Se) : "",
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
