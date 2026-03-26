import { useState, useEffect } from "react";
import { getCardThumbnailUrl } from "@/lib/assets";
import { ICardInfo } from "@/types/types";
import { AssetSourceType } from "@/contexts/ThemeContext";
import { fetchMasterData } from "@/lib/fetch";

/**
 * Hook to get card thumbnail URL from card ID
 * Loads card master data and returns the thumbnail URL
 */
export function useCardThumbnail(
    cardId: number | null,
    assetSource: AssetSourceType = "uni"
): string | null {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const displayThumbnailUrl = cardId ? thumbnailUrl : null;

    useEffect(() => {
        if (!cardId) {
            return;
        }

        let cancelled = false;

        async function loadCardData() {
            try {
                // Load cards master data using project's fetch utility
                const cards = await fetchMasterData<ICardInfo[]>("cards.json");
                if (cancelled) return;
                const card = cards.find(c => c.id === cardId);
                
                if (card) {
                    const url = getCardThumbnailUrl(
                        card.characterId,
                        card.assetbundleName,
                        false, // 默认使用未特训状态
                        assetSource
                    );
                    setThumbnailUrl(url);
                } else {
                    console.warn(`Card not found: ${cardId}`);
                    setThumbnailUrl(null);
                }
            } catch (error) {
                console.error("Error loading card data:", error);
                setThumbnailUrl(null);
            }
        }

        loadCardData();
        return () => {
            cancelled = true;
        };
    }, [cardId, assetSource]);

    return displayThumbnailUrl;
}
