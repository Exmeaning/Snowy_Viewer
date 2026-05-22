import { useMemo } from "react";
import type { CardSkillType } from "@/lib/skill";

export interface SkillTypeMapping {
    descriptionSpriteName: CardSkillType;
}

const SKILL_TYPE_NAMES: CardSkillType[] = [
    "score_up",
    "perfect_score_up",
    "life_score_up",
    "score_up_keep",
    "score_up_unit_count",
    "different_unit_score_up",
    "score_up_character_rank",
    "other_member_score_up_reference_rate",
    "judgment_up",
    "life_recovery",
];

export function useSkillMapping() {
    return useMemo<SkillTypeMapping[]>(
        () => SKILL_TYPE_NAMES.map((descriptionSpriteName) => ({ descriptionSpriteName })),
        []
    );
}
