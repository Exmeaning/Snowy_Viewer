import { useMemo } from "react";

export interface ICardSupply {
    id: number;
    cardSupplyType: string;
    assetbundleName?: string;
    name: string;
}

export function useCardSupplyTypeMapping() {
    return useMemo(
        () => [
            { type: "normal", name: "常驻" },
            { type: "birthday", name: "生日" },
            { type: "term_limited", name: "期间限定" },
            { type: "colorful_festival_limited", name: "CFES限定" },
            { type: "bloom_festival_limited", name: "BFES限定" },
            { type: "unit_event_limited", name: "WorldLink限定" },
            { type: "collaboration_limited", name: "联动限定" },
        ],
        []
    );
}
