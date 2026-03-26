/**
 * 六类剧情的元数据，供 story/ 总入口和各子页面 header 共用。
 * 修改这里即可同步更新所有页面。
 */

export type StoryTypeKey = "unit" | "event" | "card" | "area" | "self" | "special";

export interface StoryTypeInfo {
    key: StoryTypeKey;
    href: string;
    name: string;
    /** 副标题，用于各列表页 header */
    desc: string;
    color: string;
    icon: React.ReactNode;
}

import React from "react";

export const STORY_TYPES: StoryTypeInfo[] = [
    {
        key: "unit",
        href: "/story/unit",
        name: "主线剧情",
        desc: "各组合的主要剧情故事",
        color: "from-violet-500 to-purple-600",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
    },
    {
        key: "event",
        href: "/story/event",
        name: "活动剧情",
        desc: "每期活动的剧情故事",
        color: "from-miku to-cyan-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        key: "card",
        href: "/story/card",
        name: "卡牌剧情",
        desc: "每张卡牌附带的剧情故事",
        color: "from-pink-500 to-rose-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
        ),
    },
    {
        key: "area",
        href: "/story/area",
        name: "区域对话",
        desc: "各区域场景中的角色日常对话",
        color: "from-emerald-500 to-teal-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
        ),
    },
    {
        key: "self",
        href: "/story/self",
        name: "自我介绍",
        desc: "角色的自我介绍（升学前后）",
        color: "from-amber-500 to-orange-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        key: "special",
        href: "/story/special",
        name: "特殊剧情",
        desc: "周年纪念等特殊场合的剧情",
        color: "from-indigo-500 to-blue-500",
        icon: (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
        ),
    },
];

export function getStoryType(key: StoryTypeKey): StoryTypeInfo {
    return STORY_TYPES.find(t => t.key === key)!;
}
