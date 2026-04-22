import { useMemo } from "react";
import type { CardSkillType } from "@/lib/skill";

export interface SkillTypeMapping {
    descriptionSpriteName: CardSkillType;
    name: string;
}

export function useSkillMapping() {
    return useMemo<SkillTypeMapping[]>(
        () => [
            { descriptionSpriteName: "score_up", name: "分" },
            { descriptionSpriteName: "perfect_score_up", name: "P分" },
            { descriptionSpriteName: "life_score_up", name: "血分" },
            { descriptionSpriteName: "score_up_keep", name: "判分" },
            { descriptionSpriteName: "score_up_unit_count", name: "团分" },
            { descriptionSpriteName: "different_unit_score_up", name: "异团分" },
            { descriptionSpriteName: "score_up_character_rank", name: "角色Rank分" },
            { descriptionSpriteName: "other_member_score_up_reference_rate", name: "参照分" },
            { descriptionSpriteName: "judgment_up", name: "判卡" },
            { descriptionSpriteName: "life_recovery", name: "奶卡" },
        ],
        []
    );
}
