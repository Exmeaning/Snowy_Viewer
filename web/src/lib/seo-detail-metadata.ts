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
import type { ReactNode } from "react";

import {
    defineSeoDetailPage,
    type CreateDynamicDetailMetadataOptions,
} from "@/lib/seo-metadata";
import { formatExchangeShopSuffix, formatMysekaiFlavorSuffix } from "@/lib/seo-keywords";
import { CHARACTER_NAMES } from "@/types/types";

type DetailPreset<T> = Omit<CreateDynamicDetailMetadataOptions<T>, "params">;

function defineDetailPreset<T>(preset: DetailPreset<T>) {
    return preset;
}

function detailPageFactory<T>(preset: DetailPreset<T>) {
    return (render: (props: { params?: Promise<{ id: string }> }) => ReactNode) => defineSeoDetailPage({ ...preset, render });
}

const cardDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getCardMeta>>>({
    kind: "card",
    routePrefix: "cards",
    getData: getCardMeta,
    structuredData: { parentPageKey: "cards" },
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

export const defineCardDetailPage = detailPageFactory(cardDetailPreset);

const characterDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getCharacterMeta>>>({
    kind: "character",
    routePrefix: "character",
    getData: getCharacterMeta,
    structuredData: { parentPageKey: "character" },
    build: (character, { numericId }) => ({
        title: character.name,
        descriptionKind: "character",
        descriptionValues: { name: character.name },
        images: [getCharacterIconUrl(numericId)],
        twitterCard: "summary",
    }),
});

export const defineCharacterDetailPage = detailPageFactory(characterDetailPreset);

const costumeDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getCostumeMeta>>>({
    kind: "costume",
    routePrefix: "costumes",
    getData: getCostumeMeta,
    structuredData: { parentPageKey: "costumes" },
    fallbackTwitterCard: "summary",
    build: (costume) => ({
        title: costume.name,
        descriptionKind: "costume",
        descriptionValues: { name: costume.name },
        twitterCard: "summary",
    }),
});

export const defineCostumeDetailPage = detailPageFactory(costumeDetailPreset);

const eventDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getEventMeta>>>({
    kind: "event",
    routePrefix: "events",
    getData: getEventMeta,
    structuredData: { parentPageKey: "events" },
    build: (event) => ({
        title: event.name,
        descriptionKind: "event",
        descriptionValues: { name: event.name },
        images: [getEventBannerUrl(event.asset, "main-jp")],
    }),
});

export const defineEventDetailPage = detailPageFactory(eventDetailPreset);

const exchangeDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getExchangeMeta>>>({
    kind: "exchange",
    routePrefix: "exchanges",
    getData: getExchangeMeta,
    structuredData: { parentPageKey: "exchanges" },
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

export const defineExchangeDetailPage = detailPageFactory(exchangeDetailPreset);

const gachaDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getGachaMeta>>>({
    kind: "gacha",
    routePrefix: "gacha",
    getData: getGachaMeta,
    structuredData: { parentPageKey: "gacha" },
    build: (gacha) => ({
        title: gacha.name,
        descriptionKind: "gacha",
        descriptionValues: { name: gacha.name },
        images: [getGachaLogoUrl(gacha.asset, "main-jp")],
        twitterCard: "summary",
    }),
});

export const defineGachaDetailPage = detailPageFactory(gachaDetailPreset);

const liveDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getVirtualLiveMeta>>>({
    kind: "live",
    routePrefix: "live",
    getData: getVirtualLiveMeta,
    structuredData: { parentPageKey: "live" },
    build: (live) => ({
        title: live.name,
        descriptionKind: "live",
        descriptionValues: { name: live.name },
        images: [getVirtualLiveBannerUrl(live.asset, "main-jp")],
    }),
});

export const defineLiveDetailPage = detailPageFactory(liveDetailPreset);

const mangaDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getMangaMeta>>>({
    kind: "manga",
    routePrefix: "manga",
    getData: getMangaMeta,
    structuredData: { parentPageKey: "manga" },
    build: (manga, { id }) => ({
        title: manga.title,
        descriptionKind: "manga",
        descriptionValues: { title: manga.title },
        images: [`https://moe.exmeaning.com/mangas/${id}.png`],
    }),
});

export const defineMangaDetailPage = detailPageFactory(mangaDetailPreset);

const musicDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getMusicMeta>>>({
    kind: "music",
    routePrefix: "music",
    getData: getMusicMeta,
    structuredData: { parentPageKey: "music" },
    build: (music) => ({
        title: music.title,
        descriptionKind: "music",
        descriptionValues: { title: music.title, lyricist: music.lyricist, composer: music.composer },
        images: [getMusicJacketUrl(music.asset, "main-jp")],
        twitterCard: "summary",
    }),
});

export const defineMusicDetailPage = detailPageFactory(musicDetailPreset);

const mysekaiFixtureDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getFixtureMeta>>>({
    kind: "mysekai",
    routePrefix: "mysekai",
    getData: getFixtureMeta,
    structuredData: { parentPageKey: "mysekai" },
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

export const defineMysekaiFixtureDetailPage = detailPageFactory(mysekaiFixtureDetailPreset);
