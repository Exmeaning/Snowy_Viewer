import { useMemo } from "react";

export interface ICardSupply {
    id: number;
    cardSupplyType: string;
    assetbundleName?: string;
    name: string;
}

const CARD_SUPPLY_TYPES = [
    "normal",
    "birthday",
    "term_limited",
    "colorful_festival_limited",
    "bloom_festival_limited",
    "unit_event_limited",
    "collaboration_limited",
] as const;

export type CardSupplyTypeId = typeof CARD_SUPPLY_TYPES[number];

export interface CardSupplyTypeMapping {
    type: CardSupplyTypeId;
}

export function useCardSupplyTypeMapping() {
    return useMemo<CardSupplyTypeMapping[]>(
        () => CARD_SUPPLY_TYPES.map((type) => ({ type })),
        []
    );
}
