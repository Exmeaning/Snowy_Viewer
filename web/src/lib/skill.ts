
import { ICardInfo, ISkillInfo, CHARACTER_NAMES } from "@/types/types";

/**
 * Formats the skill description by replacing placeholders with actual values.
 * Based on sekai.best implementation.
 */
export function formatSkillDescription(
    skill: ISkillInfo,
    skillLevel: number,
    card?: ICardInfo
): string {
    if (!skill || !skill.description) return "";

    let newSkillInfo = skill.description;

    // Regular expressions for placeholders
    // Single arg: {{id;type}}
    const singleRegExp = /{{(\d+);(\w+)}}/g;
    // Double arg: {{min,max;type}}
    const doubleRegExp = /{{(\d+),(\d+);(\w+)}}/g;

    // Replace single argument placeholders
    // Types: d (duration), v (value), e (enhance), m (multiplier), c (character name)
    newSkillInfo = newSkillInfo.replace(singleRegExp, (match, idStr, type) => {
        const id = Number(idStr);

        // Handle character name special case
        if (type === "c" && card) {
            const charaName = CHARACTER_NAMES[card.characterId];
            return charaName || match;
        }

        // Find the skill effect
        const skillEffect = skill.skillEffects.find(eff => eff.id === id);
        if (!skillEffect) return match;

        // Find details for the specific level
        const detail = skillEffect.skillEffectDetails.find(d => d.level === skillLevel);
        if (!detail) return match;

        switch (type) {
            case "d": // Duration
                return String(detail.activateEffectDuration);
            case "v": // Value
                return String(detail.activateEffectValue);
            case "e": // Enhance value
                // Typically used for perfect scorer skills where it boosts the score up
                return skillEffect.skillEnhance?.activateEffectValue
                    ? String(skillEffect.skillEnhance.activateEffectValue)
                    : match;
            case "m": // Multiplier (5 * enhance + base)
                if (skillEffect.skillEnhance?.activateEffectValue) {
                    return String(
                        skillEffect.skillEnhance.activateEffectValue * 5 +
                        detail.activateEffectValue
                    );
                }
                return match;
            default:
                return match;
        }
    });

    // Replace double argument placeholders
    // These are usually conditional skills (e.g. valid for rank range)
    // For a generic viewer, we can assume the condition is met to show the max potential
    // or arguably handled differently. For now, let's try to extract the "Value".
    newSkillInfo = newSkillInfo.replace(doubleRegExp, (match, id1Str, id2Str, type) => {
        const id1 = Number(id1Str);
        const id2 = Number(id2Str);

        // Helper to get effect value at current level
        const getEffectValue = (effectId: number) => {
            const effect = skill.skillEffects.find(e => e.id === effectId);
            if (!effect) return 0;
            const detail = effect.skillEffectDetails.find(d => d.level === skillLevel);
            return detail ? detail.activateEffectValue : 0;
        };

        const val1 = getEffectValue(id1);
        const val2 = getEffectValue(id2);

        // Logic based on sekai.best / sekaidex behavior for static display
        // We assume we want to show the specific values referenced by the IDs.
        // For "Max X%", it usually involves summing the base and the max bonus.

        switch (type) {
            case "u": // Unit Scaling (Base + Max Bonus)
            case "o": // Option/Other (Base + Bonus)
            case "s": // Score (Base + Rank Bonus)
            case "v": // Value (Base + Rank Bonus)
                // For these, we sum the two values to get the total/max
                return String(val1 + val2);

            case "r": // Rank requirement range?
                // Logic usually checks if rank is within range.
                // For static display, we might just want to show the value of the secondary ID 
                // if it implies the "target" value, or maybe just val2?
                // Based on reference, 'r' usually returns a specific value based on rank match.
                // If we assume "Max", we might default to val2 (the max rank effect).
                return String(val2 > 0 ? val2 : val1);

            default:
                return match;
        }
    });

    return newSkillInfo;
}
