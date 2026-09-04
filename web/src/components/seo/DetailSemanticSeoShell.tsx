"use client";

import type { ReactNode } from "react";
import type { DetailSeoSemanticPayload } from "@/contexts/DetailSeoSummaryContext";
import type {
    CardMeta,
    MusicMeta,
    EventMeta,
    GachaMeta,
    CharacterMeta,
    VirtualLiveMeta,
    CostumeMeta,
    FixtureMeta,
    MangaMeta,
    ExchangeMeta,
} from "@/lib/metadata";
import { CHARACTER_NAMES } from "@/types/types";

export interface DetailSemanticSeoShellProps {
    title: string;
    description: string;
    semantic?: DetailSeoSemanticPayload;
}

function formatDateSafe(val?: number | string | null): string {
    if (!val) return "";
    const num = Number(val);
    if (!Number.isNaN(num) && num > 0) {
        try {
            return new Date(num).toISOString().split("T")[0];
        } catch {
            return String(val);
        }
    }
    return String(val);
}

function renderCardSemantic(card: CardMeta, title: string) {
    const charaName = CHARACTER_NAMES[card.characterId] || "";
    const normalPower = card.power?.normal;
    const trainedPower = card.power?.trained;

    return (
        <>
            <h1>{title}</h1>
            <p>
                {charaName ? `${charaName} - ` : ""}{card.prefix} | {card.rarity} | {card.attr}
                {card.releaseAt ? ` | 发布日期: ${formatDateSafe(card.releaseAt)}` : ""}
            </p>

            {card.power && (
                <table>
                    <caption>卡牌数值表 (Card Parameters)</caption>
                    <thead>
                        <tr>
                            <th scope="col">状态</th>
                            <th scope="col">表现力 (Performance)</th>
                            <th scope="col">技巧 (Technique)</th>
                            <th scope="col">体能 (Stamina)</th>
                            <th scope="col">综合力 (Total Power)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {normalPower && (
                            <tr>
                                <td>通常 / 特训前</td>
                                <td>{normalPower.performance}</td>
                                <td>{normalPower.technique}</td>
                                <td>{normalPower.stamina}</td>
                                <td>{normalPower.total}</td>
                            </tr>
                        )}
                        {trainedPower && (
                            <tr>
                                <td>特训后 / 开花后</td>
                                <td>{trainedPower.performance}</td>
                                <td>{trainedPower.technique}</td>
                                <td>{trainedPower.stamina}</td>
                                <td>{trainedPower.total}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}

            {(card.skillName || card.skillDesc) && (
                <dl>
                    <dt>技能名称</dt>
                    <dd>{card.skillName || "无"}</dd>
                    <dt>技能描述</dt>
                    <dd>{card.skillDesc || "无"}</dd>
                </dl>
            )}

            {card.event && (
                <ul>
                    <li>登场活动: {card.event.name}</li>
                </ul>
            )}
        </>
    );
}

function renderMusicSemantic(music: MusicMeta, title: string) {
    return (
        <>
            <h1>{music.title || title}</h1>
            <dl>
                <dt>歌曲名称</dt>
                <dd>{music.title}</dd>
                {music.lyricist && (
                    <>
                        <dt>作词</dt>
                        <dd>{music.lyricist}</dd>
                    </>
                )}
                {music.composer && (
                    <>
                        <dt>作曲</dt>
                        <dd>{music.composer}</dd>
                    </>
                )}
            </dl>
        </>
    );
}

function renderEventSemantic(event: EventMeta, title: string) {
    return (
        <>
            <h1>{event.name || title}</h1>
            <dl>
                <dt>活动名称</dt>
                <dd>{event.name}</dd>
                {event.type && (
                    <>
                        <dt>活动类型</dt>
                        <dd>{event.type}</dd>
                    </>
                )}
                {event.startAt && (
                    <>
                        <dt>开始时间</dt>
                        <dd>{formatDateSafe(event.startAt)}</dd>
                    </>
                )}
                {event.endAt && (
                    <>
                        <dt>结束时间</dt>
                        <dd>{formatDateSafe(event.endAt)}</dd>
                    </>
                )}
            </dl>
        </>
    );
}

function renderGachaSemantic(gacha: GachaMeta, title: string) {
    return (
        <>
            <h1>{gacha.name || title}</h1>
            <dl>
                <dt>扭蛋名称</dt>
                <dd>{gacha.name}</dd>
                {gacha.type && (
                    <>
                        <dt>卡池类型</dt>
                        <dd>{gacha.type}</dd>
                    </>
                )}
            </dl>
        </>
    );
}

function renderCharacterSemantic(character: CharacterMeta, title: string) {
    return (
        <>
            <h1>{character.name || title}</h1>
            <p>{character.name} Project SEKAI 角色资料、卡牌图鉴与关联乐曲</p>
        </>
    );
}

function renderCostumeSemantic(costume: CostumeMeta, title: string) {
    return (
        <>
            <h1>{costume.name || title}</h1>
            <p>{costume.name} Project SEKAI 服装模型与部件详情</p>
        </>
    );
}

function renderVirtualLiveSemantic(vl: VirtualLiveMeta, title: string) {
    return (
        <>
            <h1>{vl.name || title}</h1>
            <dl>
                <dt>演出名称</dt>
                <dd>{vl.name}</dd>
                {vl.startAt && (
                    <>
                        <dt>开始时间</dt>
                        <dd>{formatDateSafe(vl.startAt)}</dd>
                    </>
                )}
                {vl.endAt && (
                    <>
                        <dt>结束时间</dt>
                        <dd>{formatDateSafe(vl.endAt)}</dd>
                    </>
                )}
            </dl>
        </>
    );
}

function renderFixtureSemantic(fixture: FixtureMeta, title: string) {
    return (
        <>
            <h1>{fixture.name || title}</h1>
            <dl>
                <dt>设施名称</dt>
                <dd>{fixture.name}</dd>
                {fixture.flavor && (
                    <>
                        <dt>介绍说明</dt>
                        <dd>{fixture.flavor}</dd>
                    </>
                )}
            </dl>
        </>
    );
}

function renderMangaSemantic(manga: MangaMeta, title: string) {
    return (
        <>
            <h1>{manga.title || title}</h1>
            <p>{manga.title} Project SEKAI 官方四格漫画</p>
        </>
    );
}

function renderExchangeSemantic(exchange: ExchangeMeta, title: string) {
    return (
        <>
            <h1>{exchange.name || title}</h1>
            <dl>
                <dt>兑换项名称</dt>
                <dd>{exchange.name}</dd>
                {exchange.summaryName && (
                    <>
                        <dt>兑换所</dt>
                        <dd>{exchange.summaryName}</dd>
                    </>
                )}
                {exchange.category && (
                    <>
                        <dt>分类</dt>
                        <dd>{exchange.category}</dd>
                    </>
                )}
            </dl>
        </>
    );
}

export default function DetailSemanticSeoShell({
    title,
    description,
    semantic,
}: DetailSemanticSeoShellProps) {
    let content: ReactNode = null;

    if (semantic && semantic.data) {
        switch (semantic.kind) {
            case "card":
                content = renderCardSemantic(semantic.data as CardMeta, title);
                break;
            case "music":
            case "lyrics":
                content = renderMusicSemantic(semantic.data as MusicMeta, title);
                break;
            case "event":
                content = renderEventSemantic(semantic.data as EventMeta, title);
                break;
            case "gacha":
                content = renderGachaSemantic(semantic.data as GachaMeta, title);
                break;
            case "character":
                content = renderCharacterSemantic(semantic.data as CharacterMeta, title);
                break;
            case "costume":
                content = renderCostumeSemantic(semantic.data as CostumeMeta, title);
                break;
            case "virtualLive":
                content = renderVirtualLiveSemantic(semantic.data as VirtualLiveMeta, title);
                break;
            case "mysekai":
                content = renderFixtureSemantic(semantic.data as FixtureMeta, title);
                break;
            case "manga":
                content = renderMangaSemantic(semantic.data as MangaMeta, title);
                break;
            case "exchange":
                content = renderExchangeSemantic(semantic.data as ExchangeMeta, title);
                break;
            default:
                content = (
                    <>
                        <h1>{title}</h1>
                        <p>{description}</p>
                    </>
                );
        }
    } else {
        content = (
            <>
                <h1>{title}</h1>
                <p>{description}</p>
            </>
        );
    }

    return (
        <article className="sr-only" aria-label={title}>
            {content}
            <p>{description}</p>
        </article>
    );
}
