import {
    getCardThumbnailUrl,
    getCharacterIconUrl,
    getEventBannerUrl,
    getGachaLogoUrl,
    getMusicJacketUrl,
    getMysekaiFixtureThumbnailUrl,
    getVirtualLiveBannerUrl,
} from "@/lib/assets";
import {
    getCardMeta,
    getCharacterMeta,
    getCostumeMeta,
    getEventMeta,
    getExchangeMeta,
    getFixtureMeta,
    getGachaMeta,
    getMangaMeta,
    getMusicMeta,
    getVirtualLiveMeta,
} from "@/lib/metadata";
import { dynamicDetailMetadata } from "@/lib/seo-metadata";
import { formatExchangeShopSuffix, formatMysekaiFlavorSuffix } from "@/lib/seo-keywords";
import { CHARACTER_NAMES } from "@/types/types";

export const cardDetailMetadata = dynamicDetailMetadata({
    kind: "card",
    routePrefix: "cards",
    getData: getCardMeta,
    build: (card) => {
        const characterName = CHARACTER_NAMES[card.characterId] || "";

        return {
            title: `${characterName} - ${card.prefix}`,
            descriptionKind: "card",
            descriptionValues: { prefix: card.prefix, character: characterName },
            images: [getCardThumbnailUrl(card.characterId, card.asset, false, "main-jp")],
        };
    },
});

export const characterDetailMetadata = dynamicDetailMetadata({
    kind: "character",
    routePrefix: "character",
    getData: getCharacterMeta,
    build: (character, { numericId }) => ({
        title: character.name,
        descriptionKind: "character",
        descriptionValues: { name: character.name },
        images: [getCharacterIconUrl(numericId)],
        twitterCard: "summary",
    }),
});

export const costumeDetailMetadata = dynamicDetailMetadata({
    kind: "costume",
    routePrefix: "costumes",
    getData: getCostumeMeta,
    fallbackTwitterCard: "summary",
    build: (costume) => ({
        title: costume.name,
        descriptionKind: "costume",
        descriptionValues: { name: costume.name },
        twitterCard: "summary",
    }),
});

export const eventDetailMetadata = dynamicDetailMetadata({
    kind: "event",
    routePrefix: "events",
    getData: getEventMeta,
    build: (event) => ({
        title: event.name,
        descriptionKind: "event",
        descriptionValues: { name: event.name },
        images: [getEventBannerUrl(event.asset, "main-jp")],
    }),
});

export const exchangeDetailMetadata = dynamicDetailMetadata({
    kind: "exchange",
    routePrefix: "exchanges",
    getData: getExchangeMeta,
    fallbackTwitterCard: "summary",
    build: (exchange, { locale }) => ({
        title: exchange.summaryName && exchange.summaryName !== exchange.name
            ? `${exchange.name} - ${exchange.summaryName}`
            : exchange.name,
        descriptionKind: "exchange",
        descriptionValues: {
            name: exchange.name,
            shopSuffix: formatExchangeShopSuffix(exchange.summaryName, locale),
        },
        twitterCard: "summary",
    }),
});

export const gachaDetailMetadata = dynamicDetailMetadata({
    kind: "gacha",
    routePrefix: "gacha",
    getData: getGachaMeta,
    build: (gacha) => ({
        title: gacha.name,
        descriptionKind: "gacha",
        descriptionValues: { name: gacha.name },
        images: [getGachaLogoUrl(gacha.asset, "main-jp")],
        twitterCard: "summary",
    }),
});

export const liveDetailMetadata = dynamicDetailMetadata({
    kind: "live",
    routePrefix: "live",
    getData: getVirtualLiveMeta,
    build: (live) => ({
        title: live.name,
        descriptionKind: "live",
        descriptionValues: { name: live.name },
        images: [getVirtualLiveBannerUrl(live.asset, "main-jp")],
    }),
});

export const mangaDetailMetadata = dynamicDetailMetadata({
    kind: "manga",
    routePrefix: "manga",
    getData: getMangaMeta,
    build: (manga, { id }) => ({
        title: manga.title,
        descriptionKind: "manga",
        descriptionValues: { title: manga.title },
        images: [`https://moe.exmeaning.com/mangas/${id}.png`],
    }),
});

export const musicDetailMetadata = dynamicDetailMetadata({
    kind: "music",
    routePrefix: "music",
    getData: getMusicMeta,
    build: (music) => ({
        title: music.title,
        descriptionKind: "music",
        descriptionValues: { title: music.title, lyricist: music.lyricist, composer: music.composer },
        images: [getMusicJacketUrl(music.asset, "main-jp")],
        twitterCard: "summary",
    }),
});

export const mysekaiFixtureDetailMetadata = dynamicDetailMetadata({
    kind: "mysekai",
    routePrefix: "mysekai",
    getData: getFixtureMeta,
    build: (fixture, { locale }) => ({
        title: fixture.name,
        descriptionKind: "mysekai",
        descriptionValues: {
            name: fixture.name,
            flavorSuffix: formatMysekaiFlavorSuffix(fixture.flavor, locale),
        },
        images: [getMysekaiFixtureThumbnailUrl(fixture.asset, "main-jp")],
        twitterCard: "summary",
    }),
});
