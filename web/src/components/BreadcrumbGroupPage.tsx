"use client";
import React from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { useI18n } from "@/contexts/I18nContext";
import { useEffect } from "react";
import type { NavGroupData } from "@/lib/navigation";
import { NAV_GROUP_LABEL_KEYS, NAV_ITEM_DESCRIPTION_KEYS, NAV_ITEM_LABEL_KEYS } from "@/lib/navigation";

/** 每个导航项的描述文案 */
const ITEM_DESCRIPTIONS: Record<string, string> = {
    "/cards": "浏览所有卡牌数据",
    "/music": "浏览所有歌曲信息",
    "/music/meta": "查看歌曲难度与数据分析",
    "/soundtrack": "精致的背景音乐原声带播放器",
    "/character": "查看角色详细资料",
    "/costumes": "浏览角色服装一览",
    "/honors": "查看称号图鉴",
    "/sticker": "浏览游戏内贴纸",
    "/comic": "阅读官方漫画",
    "/manga": "阅读官方四格漫画",
    "/mysekai": "浏览家具图鉴",
    "/materials": "浏览持有物图鉴",
    "/exchanges": "浏览兑换所条目与奖励信息",
    "/events": "查看活动列表与详情",
    "/gacha": "查看扭蛋卡池信息",
    "/live": "查看虚拟演唱会信息",
    "/story/event": "阅读活动剧情",
    "/story/unit": "阅读各组合主线故事",
    "/story/card": "阅读卡牌前后篇故事",
    "/story/area": "阅读区域日常对话",
    "/story/self": "阅读角色自我介绍",
    "/story/special": "阅读特殊场合剧情",
    "/prediction": "查看活动排名预测",
    "/guides": "查看社区攻略",
    "/deck-recommend": "根据条件推荐最优卡组",
    "/deck-comparator": "对比不同卡组的综合力",
    "/score-control": "计算控分所需的分数",
    "/sticker-maker": "自定义制作表情包",
    "/goods-gacha": "模拟谷子盲抽概率",
    "/guess-who": "根据卡牌猜测角色",
    "/guess-jacket": "根据曲绘猜测歌曲",
    "/chart-preview": "预览谱面文件",
    "/mysekai-preview": "浏览烤森百景活动 TOP 投稿排行",
    "/mysekai-preview/ranking": "查看烤森百景排行作品预览",
    "/mysekai-preview/scene": "通过 UID 或浏览器端 JSON 预览 3D 烤森场景",
    "/profile": "查看与管理个人信息",
    "/my-cards": "追踪卡牌收集进度",
    "/my-musics": "追踪歌曲游玩进度",
    "/my-materials": "查询拥有的资源情况",
    "/patreon": "支持项目持续开发",
    "/about": "关于 Moesekai 项目",
};

interface BreadcrumbGroupPageProps {
    group: NavGroupData;
}

export default function BreadcrumbGroupPage({ group }: BreadcrumbGroupPageProps) {
    const { setDetailName } = useBreadcrumb();
    const { t } = useI18n();

    const groupLabel = t(NAV_GROUP_LABEL_KEYS[group.href] ?? group.title);
    const getItemLabel = (href: string, fallback: string) => t(NAV_ITEM_LABEL_KEYS[href] ?? fallback);
    const getItemDescription = (href: string) => t(NAV_ITEM_DESCRIPTION_KEYS[href] ?? "");

    useEffect(() => {
        setDetailName(null);
    }, [setDetailName]);

    return (
        <MainLayout>
            <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
                {/* Title */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-8 w-1.5 rounded-full bg-miku" />
                    <h1 className="text-2xl font-bold text-primary-text">{groupLabel}</h1>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((item) => (
                        <Link key={item.href} href={item.href} className="group">
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-miku/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                                <h3 className="text-base font-bold text-slate-800 group-hover:text-miku transition-colors">
                                    {getItemLabel(item.href, item.name)}
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">
                                    {getItemDescription(item.href) || ITEM_DESCRIPTIONS[item.href] || ""}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
}
