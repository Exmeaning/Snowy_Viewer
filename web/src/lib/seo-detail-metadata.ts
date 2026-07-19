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
import { createElement, Suspense, type ComponentType, type ReactNode } from "react";

import {
    defineSeoDetailPage,
    type CreateDynamicDetailMetadataOptions,
} from "@/lib/seo-metadata";
import { formatExchangeShopSuffix, formatMysekaiFlavorSuffix } from "@/lib/seo-keywords";
import { getSeoAssetSource } from "@/lib/seo-metadata";
import { CHARACTER_NAMES } from "@/types/types";

type DetailPreset<T> = Omit<CreateDynamicDetailMetadataOptions<T>, "params">;

type DetailPageRender = (props: { params?: Promise<{ id: string }> }) => ReactNode;

const DETAIL_LOADING_FALLBACK = createElement(
    "div",
    { className: "min-h-screen flex items-center justify-center" },
    createElement("div", { className: "loading-spinner" }),
);

function defineDetailPreset<T>(preset: DetailPreset<T>) {
    return preset;
}

function detailPageFactory<T>(preset: DetailPreset<T>) {
    return (render: DetailPageRender) => defineSeoDetailPage({ ...preset, render });
}

interface DetailClientPageOptions {
    fallback?: ReactNode;
    wrap?: (children: ReactNode) => ReactNode;
}

function renderClientWithSuspense(Client: ComponentType, options: DetailClientPageOptions = {}) {
    function DetailClientSuspensePage() {
        const content = createElement(Suspense, { fallback: options.fallback ?? DETAIL_LOADING_FALLBACK }, createElement(Client));
        return options.wrap ? options.wrap(content) : content;
    }

    DetailClientSuspensePage.displayName = `SeoDetailClientPage(${Client.displayName || Client.name || "Client"})`;
    return DetailClientSuspensePage;
}

function detailClientPageFactory<T>(preset: DetailPreset<T>) {
    return (Client: ComponentType, options?: DetailClientPageOptions) => defineSeoDetailPage({
        ...preset,
        render: renderClientWithSuspense(Client, options),
    });
}

const cardDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getCardMeta>>>({
    kind: "card",
    routePrefix: "cards",
    getData: getCardMeta,
    structuredData: { parentPageKey: "cards", itemList: { getName: (card) => card.prefix } },
    build: (card, { locale }) => {
        const characterName = CHARACTER_NAMES[card.characterId] || "";

        return {
            title: `${characterName} - ${card.prefix}`,
            descriptionKind: "card",
            descriptionValues: { prefix: card.prefix, character: characterName },
            images: [getCardThumbnailUrl(card.characterId, card.asset, false, getSeoAssetSource(locale))],
        };
    },
});

export const defineCardDetailPage = detailPageFactory(cardDetailPreset);
export const defineCardDetailClientPage = detailClientPageFactory(cardDetailPreset);

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
export const defineCharacterDetailClientPage = detailClientPageFactory(characterDetailPreset);

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
export const defineCostumeDetailClientPage = detailClientPageFactory(costumeDetailPreset);

const eventDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getEventMeta>>>({
    kind: "event",
    routePrefix: "events",
    getData: getEventMeta,
    structuredData: { parentPageKey: "events", itemList: { getName: (event) => event.name } },
    build: (event, { locale }) => ({
        title: event.name,
        descriptionKind: "event",
        descriptionValues: { name: event.name },
        images: [getEventBannerUrl(event.asset, getSeoAssetSource(locale))],
    }),
});

export const defineEventDetailPage = detailPageFactory(eventDetailPreset);
export const defineEventDetailClientPage = detailClientPageFactory(eventDetailPreset);

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
export const defineExchangeDetailClientPage = detailClientPageFactory(exchangeDetailPreset);

const gachaDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getGachaMeta>>>({
    kind: "gacha",
    routePrefix: "gacha",
    getData: getGachaMeta,
    structuredData: { parentPageKey: "gacha", itemList: { getName: (gacha) => gacha.name } },
    build: (gacha, { locale }) => ({
        title: gacha.name,
        descriptionKind: "gacha",
        descriptionValues: { name: gacha.name },
        images: [getGachaLogoUrl(gacha.asset, getSeoAssetSource(locale))],
        twitterCard: "summary",
    }),
});

export const defineGachaDetailPage = detailPageFactory(gachaDetailPreset);
export const defineGachaDetailClientPage = detailClientPageFactory(gachaDetailPreset);

const liveDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getVirtualLiveMeta>>>({
    kind: "live",
    routePrefix: "live",
    getData: getVirtualLiveMeta,
    structuredData: { parentPageKey: "live", itemList: { getName: (live) => live.name } },
    build: (live, { locale }) => ({
        title: live.name,
        descriptionKind: "live",
        descriptionValues: { name: live.name },
        images: [getVirtualLiveBannerUrl(live.asset, getSeoAssetSource(locale))],
    }),
});

export const defineLiveDetailPage = detailPageFactory(liveDetailPreset);
export const defineLiveDetailClientPage = detailClientPageFactory(liveDetailPreset);

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
export const defineMangaDetailClientPage = detailClientPageFactory(mangaDetailPreset);

const musicDetailPreset = defineDetailPreset<NonNullable<ReturnType<typeof getMusicMeta>>>({
    kind: "music",
    routePrefix: "music",
    getData: getMusicMeta,
    structuredData: { parentPageKey: "music", itemList: { getName: (music) => music.title } },
    build: (music, { locale }) => ({
        title: music.title,
        descriptionKind: "music",
        descriptionValues: { title: music.title, lyricist: music.lyricist, composer: music.composer },
        images: [getMusicJacketUrl(music.asset, getSeoAssetSource(locale))],
        twitterCard: "summary",
    }),
});

export const defineMusicDetailPage = detailPageFactory(musicDetailPreset);
export const defineMusicDetailClientPage = detailClientPageFactory(musicDetailPreset);

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
        images: [getMysekaiFixtureThumbnailUrl(fixture.asset, getSeoAssetSource(locale))],
        twitterCard: "summary",
    }),
});

export const defineMysekaiFixtureDetailPage = detailPageFactory(mysekaiFixtureDetailPreset);
export const defineMysekaiFixtureDetailClientPage = detailClientPageFactory(mysekaiFixtureDetailPreset);
