import type { ReactNode } from "react";

import {
    getCardThumbnailUrl,
    getCharacterIconUrl,
    getEventBannerUrl,
} from "@/lib/assets";
import {
    getStoryAreaCategoryMeta,
    getStoryAreaReaderMeta,
    getStoryCardReaderMeta,
    getStoryEventEpisodeMeta,
    getStoryEventGroupMeta,
    getStorySelfReaderMeta,
    getStorySpecialReaderMeta,
    getStoryUnitEpisodeMeta,
    getStoryUnitGroupMeta,
} from "@/lib/metadata";
import { defineSeoDynamicPage } from "@/lib/seo-metadata";
import { getSeoAssetSource } from "@/lib/seo-metadata";

function encodePathPart(value: string | number): string {
    return encodeURIComponent(String(value));
}

function storyFallback(label: string, id: string | number): string {
    return `${label} #${id}`;
}

export const defineStoryEventGroupPage = (render: (props: { params?: Promise<{ eventId: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storyEventGroup",
    routePrefix: "story/event",
    buildPath: ({ eventId }) => `/story/event/${encodePathPart(eventId)}/`,
    getData: ({ eventId }) => getStoryEventGroupMeta(eventId),
    structuredData: {
        parentPageKey: "story_event",
        getName: (data, { params }) => data?.name ?? storyFallback("Event", params.eventId),
    },
    build: (story, { locale }) => ({
        descriptionKind: "storyEventGroup",
        descriptionValues: {
            event: story.name,
            count: story.episodeCount,
        },
        images: story.asset ? [getEventBannerUrl(story.asset, getSeoAssetSource(locale))] : undefined,
    }),
    render,
});

export const defineStoryEventReaderPage = (render: (props: { params?: Promise<{ eventId: string; episodeNo: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storyEventReader",
    routePrefix: "story/event",
    buildPath: ({ eventId, episodeNo }) => `/story/event/${encodePathPart(eventId)}/${encodePathPart(episodeNo)}/`,
    getData: ({ eventId, episodeNo }) => getStoryEventEpisodeMeta(eventId, episodeNo),
    structuredData: {
        parentPageKey: "story_event",
        getName: (data, { params }) => data?.episodeTitle ?? storyFallback("Episode", `${params.eventId}-${params.episodeNo}`),
    },
    build: (episode, { locale }) => ({
        descriptionKind: "storyEventReader",
        descriptionValues: {
            event: episode.eventName,
            episode: episode.episodeTitle,
            episodeNo: episode.episodeNo,
        },
        images: episode.asset ? [getEventBannerUrl(episode.asset, getSeoAssetSource(locale))] : undefined,
    }),
    render,
});

export const defineStoryUnitGroupPage = (render: (props: { params?: Promise<{ unitId: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storyUnitGroup",
    routePrefix: "story/unit",
    buildPath: ({ unitId }) => `/story/unit/${encodePathPart(unitId)}/`,
    getData: ({ unitId }) => getStoryUnitGroupMeta(unitId),
    structuredData: {
        parentPageKey: "story_unit",
        getName: (data, { params }) => data?.unitName ?? storyFallback("Unit", params.unitId),
    },
    build: (unit) => ({
        descriptionKind: "storyUnitGroup",
        descriptionValues: {
            unit: unit.unitName,
            count: unit.episodeCount,
        },
        twitterCard: "summary",
    }),
    render,
});

export const defineStoryUnitReaderPage = (render: (props: { params?: Promise<{ unitId: string; episodeId: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storyUnitReader",
    routePrefix: "story/unit",
    buildPath: ({ unitId, episodeId }) => `/story/unit/${encodePathPart(unitId)}/${encodePathPart(episodeId)}/`,
    getData: ({ unitId, episodeId }) => getStoryUnitEpisodeMeta(unitId, episodeId),
    structuredData: {
        parentPageKey: "story_unit",
        getName: (data, { params }) => data?.episodeTitle ?? storyFallback("Episode", params.episodeId),
    },
    build: (episode) => ({
        descriptionKind: "storyUnitReader",
        descriptionValues: {
            unit: episode.unitName,
            episode: episode.episodeTitle,
        },
        twitterCard: "summary",
    }),
    render,
});

export const defineStoryCardReaderPage = (render: (props: { params?: Promise<{ cardId: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storyCardReader",
    routePrefix: "story/card",
    buildPath: ({ cardId }) => `/story/card/${encodePathPart(cardId)}/`,
    getData: ({ cardId }) => getStoryCardReaderMeta(cardId),
    structuredData: {
        parentPageKey: "story_card",
        getName: (data, { params }) => data?.cardPrefix ?? storyFallback("Card", params.cardId),
    },
    build: (card, { locale }) => ({
        descriptionKind: "storyCardReader",
        descriptionValues: {
            card: card.cardPrefix,
        },
        images: card.asset ? [getCardThumbnailUrl(card.characterId, card.asset, false, getSeoAssetSource(locale))] : undefined,
    }),
    render,
});

export const defineStorySelfReaderPage = (render: (props: { params?: Promise<{ charaId: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storySelfReader",
    routePrefix: "story/self",
    buildPath: ({ charaId }) => `/story/self/${encodePathPart(charaId)}/`,
    getData: ({ charaId }) => getStorySelfReaderMeta(charaId),
    structuredData: {
        parentPageKey: "story_self",
        getName: (data, { params }) => data?.characterName ?? storyFallback("Character", params.charaId),
    },
    build: (character) => ({
        descriptionKind: "storySelfReader",
        descriptionValues: {
            character: character.characterName,
        },
        images: [getCharacterIconUrl(character.characterId)],
        twitterCard: "summary",
    }),
    render,
});

export const defineStorySpecialReaderPage = (render: (props: { params?: Promise<{ spId: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storySpecialReader",
    routePrefix: "story/special",
    buildPath: ({ spId }) => `/story/special/${encodePathPart(spId)}/`,
    getData: ({ spId }) => getStorySpecialReaderMeta(spId),
    structuredData: {
        parentPageKey: "story_special",
        getName: (data, { params }) => data?.title ?? storyFallback("Special", params.spId),
    },
    build: (story) => ({
        descriptionKind: "storySpecialReader",
        descriptionValues: {
            title: story.title,
            count: story.episodeCount,
        },
        twitterCard: "summary",
    }),
    render,
});

export const defineStoryAreaCategoryPage = (render: (props: { params?: Promise<{ category: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storyAreaCategory",
    routePrefix: "story/area",
    buildPath: ({ category }) => `/story/area/${encodePathPart(category)}/`,
    getData: ({ category }) => getStoryAreaCategoryMeta(category),
    structuredData: {
        parentPageKey: "story_area",
        getName: (data, { params }) => data?.label ?? params.category,
    },
    build: (category) => ({
        descriptionKind: "storyAreaCategory",
        descriptionValues: {
            category: category.label,
            count: category.count,
        },
        twitterCard: "summary",
    }),
    render,
});

export const defineStoryAreaReaderPage = (render: (props: { params?: Promise<{ category: string; scenarioId: string }> }) => ReactNode) => defineSeoDynamicPage({
    kind: "storyAreaReader",
    routePrefix: "story/area",
    buildPath: ({ category, scenarioId }) => `/story/area/${encodePathPart(category)}/${encodePathPart(scenarioId)}/`,
    getData: ({ category, scenarioId }) => getStoryAreaReaderMeta(category, scenarioId),
    structuredData: {
        parentPageKey: "story_area",
        getName: (data, { params }) => data?.areaName ?? params.scenarioId,
    },
    build: (talk) => ({
        descriptionKind: "storyAreaReader",
        descriptionValues: {
            area: talk.areaName,
            scenarioId: talk.scenarioId,
        },
        twitterCard: "summary",
    }),
    render,
});
