import { CHARACTER_NAMES, CHAR_NAMES } from "@/types/types";
import type { MessageInterpolationValues } from "./format";

export type CharacterNameVariant = "full" | "short";
export type CharacterNameTranslationFn = (key: string, values?: MessageInterpolationValues) => string;

const CHARACTER_NAME_FALLBACKS: Record<CharacterNameVariant, Record<number, string>> = {
    full: CHARACTER_NAMES,
    short: CHAR_NAMES,
};

export function getCharacterName(
    t: CharacterNameTranslationFn,
    characterId: number,
    variant: CharacterNameVariant = "full",
): string {
    const key = `common.characters.${variant}.${characterId}`;
    const translated = t(key);
    if (translated !== key) return translated;

    return CHARACTER_NAME_FALLBACKS[variant][characterId]
        ?? CHARACTER_NAMES[characterId]
        ?? `Character ${characterId}`;
}
