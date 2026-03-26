"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";

// Types for Bilibili Dynamic API
interface DynamicItem {
    id_str: string;
    type: string;
    modules: {
        module_author: {
            mid: number;
            name: string;
            face: string;
            pub_time: string;
            pub_action: string;
        };
        module_tag?: {
            text: string;
        };
        module_dynamic: {
            desc?: {
                text: string;
            };
            major?: {
                type: string;
                draw?: {
                    items: {
                        src: string;
                        width: number;
                        height: number;
                    }[];
                };
                archive?: {
                    aid: string;
                    bvid: string;
                    cover: string;
                    title: string;
                    desc: string;
                    duration_text: string;
                    jump_url: string;
                    stat: {
                        play: string;
                        danmaku: string;
                    };
                };
                opus?: {
                    jump_url: string;
                    pics: {
                        url: string;
                        width: number;
                        height: number;
                    }[];
                    summary: {
                        text: string;
                    };
                    title: string;
                };
            };
        };
        module_stat: {
            comment: {
                count: number;
                forbidden: boolean;
            };
            forward: {
                count: number;
                forbidden: boolean;
            };
            like: {
                count: number;
                forbidden: boolean;
                status: boolean;
            };
        };
    };
    basic: {
        jump_url: string;
    };
}

interface DynamicResponse {
    code: number;
    message: string;
    data: {
        items: DynamicItem[];
    };
}

const ACCOUNTS = [
    { id: "13148307", name: "日服资讯 (Project_SEKAI资讯站)", avatar: "https://i2.hdslb.com/bfs/face/485ea7b2434db0349c25dfcfb62e499709287877.jpg" },
    { id: "3546749308242173", name: "国服资讯 (初音未来缤纷舞台)", avatar: "https://i1.hdslb.com/bfs/face/178225586617a264024317769963865664a754b2.jpg" },
];

const feedCache: Record<string, { items: DynamicItem[], timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes frontend cache

export default function BilibiliDynamicTab() {
    const [activeAccount, setActiveAccount] = useState(ACCOUNTS[0]);
    const [dynamics, setDynamics] = useState<DynamicItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchDynamics() {
            try {
                // Check Cache
                if (feedCache[activeAccount.id] && Date.now() - feedCache[activeAccount.id].timestamp < CACHE_DURATION) {
                    setDynamics(feedCache[activeAccount.id].items);
                    setIsLoading(false);
                    return;
                }

                setIsLoading(true);
                setError(null);
                const res = await fetch(`/api/bilibili/dynamic/${activeAccount.id}`);
                if (!res.ok) {
                    throw new Error(`API Error: ${res.status}`);
                }
                const data: DynamicResponse = await res.json();
                if (data.code !== 0) {
                    throw new Error(`Bilibili Error: ${data.message}`);
                }
                let items = data.data.items || [];
                // Filter pinned items
                items = items.filter(item => item.modules.module_tag?.text !== "置顶");
                // Limit to 3 items
                setDynamics(items.slice(0, 3));

                // Save to Cache
                feedCache[activeAccount.id] = {
                    items: items.slice(0, 3),
                    timestamp: Date.now()
                };
            } catch (err) {
                console.error("Failed to fetch dynamics:", err);
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setIsLoading(false);
            }
        }

        fetchDynamics();
    }, [activeAccount]);

    const formatNumber = (num: number) => {
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + "万";
        }
        return num.toString();
    };

    const getProxyUrl = (url: string, type: 'avatar' | 'cover' | 'grid' | 'preview' = 'preview') => {
        if (!url) return "";

        // Remove existing params if any to avoid duplication
        const cleanUrl = url.split('@')[0];

        // Add Bilibili Image Processing Suffixes
        let suffix = "";
        switch (type) {
            case 'avatar':
                suffix = "@100w_100h_1c.webp";
                break;
            case 'cover': // Video/Article covers (16:9 usually)
                suffix = "@480w_270h_1c.webp";
                break;
            case 'grid': // 9-grid images (Square)
                suffix = "@300w_300h_1c.webp";
                break;
            case 'preview': // Full screen preview (Original or very large)
                // Use .webp for better compression even on original
                suffix = "@.webp";
                break;
        }

        const optimizedUrl = cleanUrl + suffix;
        return `/api/bilibili/image?url=${encodeURIComponent(optimizedUrl)}`;
    };

    const [previewImage, setPreviewImage] = useState<string | null>(null);

    return (
        <div>
            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setPreviewImage(null)}
                >
                    <img
                        src={previewImage}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg animate-in fade-in zoom-in duration-200"
                    />
                </div>
            )}

            {/* Account Switcher */}
            <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
                {ACCOUNTS.map((account) => (
                    <div
                        key={account.id}
                        onClick={() => setActiveAccount(account)}
                        className={`
                            flex items-center rounded-xl text-sm font-medium transition-all cursor-pointer select-none border
                            ${activeAccount.id === account.id
                                ? "bg-miku text-white shadow-lg shadow-miku/20 border-miku"
                                : "bg-white text-slate-600 hover:bg-miku/5 border border-slate-100"
                            }
                        `}
                    >
                        {/* Account Name (Click to Switch) */}
                        <div className="px-4 py-2">
                            {account.name}
                        </div>

                        {/* Divider */}
                        <div className={`w-px h-4 ${activeAccount.id === account.id ? "bg-white/20" : "bg-slate-100"}`} />

                        {/* Home Link (Click to Visit Bilibili) */}
                        <a
                            href={`https://space.bilibili.com/${account.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-3 py-2 flex items-center justify-center rounded-r-xl transition-colors ${activeAccount.id === account.id
                                ? "hover:bg-white/20 text-white"
                                : "hover:bg-slate-100 text-slate-400 hover:text-miku"
                                }`}
                            onClick={(e) => e.stopPropagation()}
                            title="访问主页"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl animate-pulse border border-slate-100">
                            <div className="flex gap-3 mb-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <div className="w-1/3 h-4 bg-slate-100 rounded" />
                                    <div className="w-1/4 h-3 bg-slate-100 rounded" />
                                </div>
                            </div>
                            <div className="w-full h-32 bg-slate-100 rounded-xl" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="p-8 text-center bg-red-50 text-red-600 rounded-2xl border border-red-100">
                    <p className="font-bold mb-2">获取动态失败</p>
                    <p className="text-sm opacity-80">{error}</p>
                    <button
                        onClick={() => setActiveAccount({ ...activeAccount })}
                        className="mt-4 px-4 py-2 bg-white text-red-600 rounded-lg text-sm font-medium border border-red-200 hover:bg-red-50 transition-colors"
                    >
                        重试
                    </button>
                </div>
            ) : dynamics.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                    暂无动态
                </div>
            ) : (
                <div className="space-y-4">
                    {dynamics.map((item) => {
                        // Construct jump URL
                        let jumpUrl = item.basic.jump_url;
                        if (!jumpUrl) {
                            jumpUrl = `https://t.bilibili.com/${item.id_str}`;
                        } else if (!jumpUrl.startsWith("http")) {
                            jumpUrl = `https:${jumpUrl}`;
                        }

                        // Construct Space URL
                        const spaceUrl = `https://space.bilibili.com/${item.modules.module_author.mid}`;

                        return (
                            <div
                                key={item.id_str}
                                className="bg-white p-5 rounded-2xl border border-slate-100 hover:shadow-sm hover:border-miku/30 transition-all group relative"
                            >
                                {/* Header (Avatar + Name + Home Link) */}
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="flex gap-3">
                                        <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="block flex-shrink-0">
                                            <img
                                                src={getProxyUrl(item.modules.module_author.face, 'avatar')}
                                                alt={item.modules.module_author.name}
                                                className="w-10 h-10 rounded-full border border-slate-100 hover:border-miku/50 transition-colors"
                                            />
                                        </a>
                                        <div>
                                            <a href={spaceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-800 text-sm hover:text-miku transition-colors block">
                                                {item.modules.module_author.name}
                                                <span className="ml-2 text-xs font-normal text-slate-400">
                                                    {item.modules.module_author.pub_action}
                                                </span>
                                            </a>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {item.modules.module_author.pub_time}
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                {/* Body Link (Content) */}
                                <a
                                    href={jumpUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group/body"
                                >
                                    {/* Text Content */}
                                    {(item.modules.module_dynamic.desc?.text || item.modules.module_dynamic.major?.opus?.summary?.text || item.modules.module_dynamic.major?.archive?.desc) && (
                                        <ExpandableText text={item.modules.module_dynamic.desc?.text || item.modules.module_dynamic.major?.opus?.summary?.text || item.modules.module_dynamic.major?.archive?.desc} />
                                    )}

                                    {/* Major Content (Image/Video/Opus) */}
                                    {/* DRAW Type */}
                                    {item.modules.module_dynamic.major?.type === "MAJOR_TYPE_DRAW" && item.modules.module_dynamic.major.draw && (
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            {item.modules.module_dynamic.major.draw.items.slice(0, 9).map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-zoom-in group/img"
                                                    onClick={(e) => {
                                                        e.preventDefault(); // Prevent link navigation
                                                        e.stopPropagation();
                                                        setPreviewImage(getProxyUrl(img.src, 'preview')); // High res for preview
                                                    }}
                                                >
                                                    <img
                                                        src={getProxyUrl(img.src, 'grid')} // Thumbnail for grid
                                                        alt="Dynamic Image"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* OPUS Type (Article/Rich Text with images) */}
                                    {item.modules.module_dynamic.major?.type === "MAJOR_TYPE_OPUS" && item.modules.module_dynamic.major.opus && (
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            {item.modules.module_dynamic.major.opus.pics.slice(0, 9).map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-zoom-in group/img"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setPreviewImage(getProxyUrl(img.url, 'preview'));
                                                    }}
                                                >
                                                    <img
                                                        src={getProxyUrl(img.url, 'grid')}
                                                        alt="Dynamic Image"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {item.modules.module_dynamic.major?.type === "MAJOR_TYPE_ARCHIVE" && item.modules.module_dynamic.major.archive && (
                                        <div className="flex gap-3 bg-slate-50 p-2 rounded-xl mb-3 group-hover/body:bg-slate-100 border border-slate-100 transition-colors">
                                            <div className="relative w-32 aspect-video rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                                <img
                                                    src={getProxyUrl(item.modules.module_dynamic.major.archive.cover, 'cover')}
                                                    alt={item.modules.module_dynamic.major.archive.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                                                    {item.modules.module_dynamic.major.archive.duration_text}
                                                </div>
                                            </div>
                                            <div className="flex-1 py-1 min-w-0">
                                                <h4 className="font-bold text-sm text-slate-800 line-clamp-2 mb-1 group-hover/body:text-miku transition-colors">
                                                    {item.modules.module_dynamic.major.archive.title}
                                                </h4>
                                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        {item.modules.module_dynamic.major.archive.stat.play}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                                        {item.modules.module_dynamic.major.archive.stat.danmaku}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Stats */}
                                    <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
                                        <div className="flex items-center gap-1.5 group-hover/body:text-miku transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                            {formatNumber(item.modules.module_stat.forward.count)}
                                        </div>
                                        <div className="flex items-center gap-1.5 group-hover/body:text-miku transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                            {formatNumber(item.modules.module_stat.comment.count)}
                                        </div>
                                        <div className="flex items-center gap-1.5 group-hover/body:text-miku transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                            {formatNumber(item.modules.module_stat.like.count)}
                                        </div>
                                    </div>
                                </a>
                            </div>
                        );
                    })}

                    <div className="text-center pt-2">
                        <div className="text-xs text-slate-400 bg-slate-50 inline-block px-3 py-1 rounded-full border border-slate-100">
                            内容来源于 Bilibili，仅供展示，不代表SnowyViewer立场
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ExpandableText({ text }: { text: string | undefined }) {
    const [expanded, setExpanded] = useState(false);

    if (!text) return null;

    // Determine if text is long enough to trunc
    const isLong = text.length > 100 || text.split('\n').length > 4;

    return (
        <div className="mb-3">
            <p className={`text-slate-700 text-sm whitespace-pre-wrap leading-relaxed ${!expanded ? "line-clamp-4" : ""}`}>
                {text}
            </p>
            {isLong && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                    className="text-miku text-xs font-bold mt-1 hover:underline"
                >
                    {expanded ? "收起全文" : "查看全文"}
                </button>
            )}
        </div>
    );
}
