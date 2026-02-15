"use client";
import React, { useState, Suspense } from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";
import ExternalLink from "@/components/ExternalLink";
import CurrentEventTab from "@/components/home/CurrentEventTab";
import LatestCardsTab from "@/components/home/LatestCardsTab";
import LatestMusicTab from "@/components/home/LatestMusicTab";
import BilibiliDynamicTab from "@/components/home/BilibiliDynamicTab";
import BirthdaySection from "@/components/home/BirthdaySection";
import { getTodayBirthdays } from "@/lib/birthdays";

type TabType = "event" | "cards" | "music";

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  {
    id: "event",
    label: "当前活动",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "cards",
    label: "最新卡牌",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: "music",
    label: "最新歌曲",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
];

// Loading fallback component
function TabLoading() {
  return (
    <div className="animate-pulse">
      <div className="rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 h-48 w-full" />
      <div className="mt-4 space-y-2">
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

// Shortcut definitions with icons
const SHORTCUTS = [
  {
    href: "/cards",
    label: "卡牌",
    subLabel: "CARD DATABASE",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M7 8h10" />
        <path d="M7 12h10" />
        <path d="M7 16h10" />
      </svg>
    ),
  },
  {
    href: "/music",
    label: "音乐",
    subLabel: "MUSIC LIBRARY",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "活动",
    subLabel: "EVENT LIBRARY",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    href: "/gacha",
    label: "扭蛋",
    subLabel: "GACHA",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
      </svg>
    ),
  },
  {
    href: "/sticker",
    label: "贴纸",
    subLabel: "STICKER",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" x2="9.01" y1="9" y2="9" />
        <line x1="15" x2="15.01" y1="9" y2="9" />
      </svg>
    ),
  },
  {
    href: "/comic",
    label: "漫画",
    subLabel: "COMIC",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: "/live",
    label: "演唱会",
    subLabel: "VIRTUAL LIVE",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    ),
  },
  {
    href: "/mysekai",
    label: "家具",
    subLabel: "MYSEKAI",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-miku">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("event");
  const todayBirthdays = getTodayBirthdays();
  const hasTodayBirthday = todayBirthdays.length > 0;

  return (
    <MainLayout activeNav="首页" showLoader={true}>
      <div className="container mx-auto px-6 pt-20 pb-20 flex flex-col items-center gap-12 text-center">

        {/* Main Title Section */}
        <div className="space-y-6 animate-fade-in-up">
          {/* Beta Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-amber-200 bg-amber-50 rounded-full mb-4 text-amber-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs font-bold tracking-wider uppercase">
              Beta 测试版
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-black text-primary-text leading-tight">
            <span className="text-miku mx-2">Snowybot</span> SekaiViewer
          </h1>

          {/* Performance Tip */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs">
              若页面出现卡顿，尝试在设置中使用<strong>省电模式</strong>
            </span>
          </div>

        </div>

        {/* Tabs Section (Latest Info) */}
        {hasTodayBirthday && <BirthdaySection />}
        <div className="w-full max-w-5xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl font-bold text-primary-text opacity-80">最新</h2>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300
                  ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-miku to-miku-dark text-white shadow-lg shadow-miku/20'
                    : 'bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200/50'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="text-left">
            <Suspense fallback={<TabLoading />}>
              {activeTab === "event" && <CurrentEventTab />}
              {activeTab === "cards" && <LatestCardsTab />}
              {activeTab === "music" && <LatestMusicTab />}
            </Suspense>
          </div>
        </div>

        {/* Shortcuts Section (捷径) */}
        <div className="w-full max-w-5xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl font-bold text-primary-text opacity-80">捷径</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {SHORTCUTS.map((shortcut, index) => (
              <Link key={index} href={shortcut.href} className="group">
                <div className="p-6 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-3 text-center h-full justify-center">
                  <div className="transition-transform duration-300 group-hover:scale-110">
                    {shortcut.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">{shortcut.label}</h3>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">{shortcut.subLabel}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Dynamic Section (Bilibili) */}
        <div className="w-full max-w-5xl text-left">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl font-bold text-primary-text opacity-80">动态</h2>
          </div>
          <BilibiliDynamicTab />
        </div>

        {/* Birthday Section (if no birthday today, show at bottom) */}
        {!hasTodayBirthday && <BirthdaySection />}

        {/* Friendly Links Section (友链) */}
        <div className="w-full max-w-5xl mt-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl font-bold text-primary-text opacity-80">友链</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Link 1: SnowyBot */}
            <ExternalLink href="https://snowybot.exmeaning.com" target="_blank" className="relative group overflow-hidden rounded-xl h-20 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-6">
                <div className="text-left">
                  <h3 className="text-md font-bold text-primary-text">SnowyBot 主站</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Main Site</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </ExternalLink>

            {/* Link 2: Story */}
            <ExternalLink href="https://sekaistory.exmeaning.com/" target="_blank" className="relative group overflow-hidden rounded-xl h-20 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-6">
                <div className="text-left">
                  <h3 className="text-md font-bold text-primary-text">剧情站</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Story Reader</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
            </ExternalLink>

            {/* Link 3: Predictor */}
            <ExternalLink href="https://sekaibangdan.exmeaning.com" target="_blank" className="relative group overflow-hidden rounded-xl h-20 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-6">
                <div className="text-left">
                  <h3 className="text-md font-bold text-primary-text">预测站</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Predictor</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
            </ExternalLink>
          </div>
        </div>

        {/* Credits Section (鸣谢) */}
        <div className="w-full max-w-5xl mt-8 pt-8 border-t border-slate-200/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">鸣谢</h2>
            <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center text-sm">
              <span className="text-slate-400">Special Thanks:</span>
              <ExternalLink href="https://github.com/MejiroRina" target="_blank" className="font-bold text-slate-500 hover:text-miku transition-colors">Haruki（希凪）</ExternalLink>
              <span className="text-slate-300">|</span>
              <ExternalLink href="https://sekai.best" target="_blank" className="font-bold text-slate-500 hover:text-miku transition-colors">Sekai.best</ExternalLink>
              <span className="text-slate-300">|</span>
              <ExternalLink href="https://github.com/watagashi-uni" target="_blank" className="font-bold text-slate-500 hover:text-miku transition-colors">Uni</ExternalLink>
            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
