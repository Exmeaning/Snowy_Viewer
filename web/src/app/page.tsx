"use client";
import React, { useState, useEffect, Suspense } from "react";
import Link from "@/components/LocalizedLink";
import SetupGuide from "@/components/home/SetupGuide";
import MainLayout from "@/components/MainLayout";
import ExternalLink from "@/components/ExternalLink";
import HeroCarousel from "@/components/home/HeroCarousel";
import CurrentEventTab from "@/components/home/CurrentEventTab";
import LatestCardsTab from "@/components/home/LatestCardsTab";
import LatestMusicTab from "@/components/home/LatestMusicTab";
import UpcomingLiveTab from "@/components/home/UpcomingLiveTab";
import AnnouncementSection from "@/components/home/AnnouncementSection";
import BirthdaySection from "@/components/home/BirthdaySection";
import { MOE_LOGO_URL } from "@/lib/assets";
import { MOESEKAI_BILIBILI_SPACE_URL } from "@/lib/team-links";
import { useI18n } from "@/contexts/I18nContext";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getMotionTransition } from "@/lib/motion";

type TabType = "event" | "cards" | "music" | "live";

const TABS: { id: TabType; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: "event",
    labelKey: "page.home.tabs.event",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "cards",
    labelKey: "page.home.tabs.cards",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: "music",
    labelKey: "page.home.tabs.music",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    id: "live",
    labelKey: "page.home.tabs.live",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" strokeWidth={2} />
        <polyline points="17 2 12 7 7 2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
    labelKey: "page.home.shortcuts.cards",
    subLabel: "CARD",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M7 8h10" />
        <path d="M7 12h10" />
        <path d="M7 16h10" />
      </svg>
    ),
  },
  {
    href: "/music",
    labelKey: "page.home.shortcuts.music",
    subLabel: "MUSIC",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    href: "/events",
    labelKey: "page.home.shortcuts.events",
    subLabel: "EVENT",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    href: "/gacha",
    labelKey: "page.home.shortcuts.gacha",
    subLabel: "GACHA",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
      </svg>
    ),
  },
  {
    href: "/character",
    labelKey: "page.home.shortcuts.character",
    subLabel: "CHARA",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
        <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
      </svg>
    ),
  },
  {
    href: "/sticker",
    labelKey: "page.home.shortcuts.sticker",
    subLabel: "STICKER",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" x2="9.01" y1="9" y2="9" />
        <line x1="15" x2="15.01" y1="9" y2="9" />
      </svg>
    ),
  },
  {
    href: "/comic",
    labelKey: "page.home.shortcuts.comic",
    subLabel: "COMIC",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: "/live",
    labelKey: "page.home.shortcuts.live",
    subLabel: "LIVE",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    ),
  },
  {
    href: "/mysekai",
    labelKey: "page.home.shortcuts.mysekai",
    subLabel: "MYSEKAI",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/costumes",
    labelKey: "page.home.shortcuts.costumes",
    subLabel: "COSTUME",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    href: "/honors",
    labelKey: "page.home.shortcuts.honors",
    subLabel: "HONOR",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138c.114.718.38 1.38.806 1.946a3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438c.426-.566.692-1.228.806-1.946a3.42 3.42 0 0 1 3.138-3.138z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    labelKey: "page.home.shortcuts.profile",
    subLabel: "PROFILE",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M5.121 17.804A13.937 13.937 0 0 1 12 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: "/deck-recommend",
    labelKey: "page.home.shortcuts.deckRecommend",
    subLabel: "DECK",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/prediction",
    labelKey: "page.home.shortcuts.prediction",
    subLabel: "PREDICT",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: "/guess-who",
    labelKey: "page.home.shortcuts.guessWho",
    subLabel: "GUESS",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: "/chart-preview",
    labelKey: "page.home.shortcuts.chartPreview",
    subLabel: "CHART",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-miku">
        <path d="M14.752 11.168l-3.197-2.132A1 1 0 0 0 10 9.87v4.263a1 1 0 0 0 1.555.832l3.197-2.132a1 1 0 0 0 0-1.664Z" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: MOESEKAI_BILIBILI_SPACE_URL,
    labelKey: "page.home.shortcuts.bilibili",
    subLabel: "BILIBILI",
    isExternal: true,
    badgeKey: "page.home.shortcuts.bilibiliBadge",
    icon: (
      <svg className="w-5 h-5 text-[#fb7299]" viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.977 3.561a1.31 1.31 0 111.818-1.884l2.828 2.728c.08.078.149.163.205.254h4.277a1.32 1.32 0 01.205-.254l2.828-2.728a1.31 1.31 0 011.818 1.884L17.82 4.66h.848A5.333 5.333 0 0124 9.992v7.34a5.333 5.333 0 01-5.333 5.334H5.333A5.333 5.333 0 010 17.333V9.992a5.333 5.333 0 015.333-5.333h.781L4.977 3.56zm.356 3.67a2.667 2.667 0 00-2.666 2.667v7.529a2.667 2.667 0 002.666 2.666h13.334a2.667 2.667 0 002.666-2.666v-7.53a2.667 2.667 0 00-2.666-2.666H5.333zm1.334 5.192a1.333 1.333 0 112.666 0v1.192a1.333 1.333 0 11-2.666 0v-1.192zM16 11.09c-.736 0-1.333.597-1.333 1.333v1.192a1.333 1.333 0 102.666 0v-1.192c0-.736-.597-1.333-1.333-1.333z"
        />
      </svg>
    ),
  },
];

export default function Home() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>("event");
  const [showSetup, setShowSetup] = useState(false);
  const [showSettingsHint, setShowSettingsHint] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const hintTransition = getMotionTransition("soft", {
    reducedMotion: !!prefersReducedMotion,
  });

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const completed = localStorage.getItem("moesekai_setup_completed") === "true";
      if (!completed) {
        setShowSetup(true);
      }
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  useEffect(() => {
    if (!showSettingsHint) return;
    const timer = setTimeout(() => {
      setShowSettingsHint(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [showSettingsHint]);

  return (
    <MainLayout showLoader={true}>
      {showSetup && (
        <SetupGuide
          onComplete={(showHint) => {
            setShowSetup(false);
            if (showHint) {
              setShowSettingsHint(true);
            }
          }}
        />
      )}

      <AnimatePresence>
        {showSettingsHint && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.98 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            transition={hintTransition}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] w-[90%] max-w-md material-thick island-panel p-4 rounded-2xl flex items-center gap-3 text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-miku/15 dark:bg-miku/20 flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div className="flex-1 pr-2">
              <p className="text-xs sm:text-sm type-title font-bold text-slate-800 dark:text-slate-100">
                {t("page.setup.settingsHint")}
              </p>
            </div>
            <button
              onClick={() => setShowSettingsHint(false)}
              className="pressable text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 sm:px-6 pt-6 pb-16 flex flex-col items-center gap-8">

        {/* ─── Logo (compact inline) ─── */}
        <div className="flex flex-col items-center gap-1 animate-fade-in-up">
          <h1 className="flex items-center gap-2">
            <div
              className="h-10 w-40 sm:h-12 sm:w-48 bg-gradient-to-r from-miku to-miku-dark transition-all hover:brightness-110"
              style={{
                maskImage: `url(${MOE_LOGO_URL})`,
                maskSize: "contain",
                maskPosition: "center",
                maskRepeat: "no-repeat",
                WebkitMaskImage: `url(${MOE_LOGO_URL})`,
                WebkitMaskSize: "contain",
                WebkitMaskPosition: "center",
                WebkitMaskRepeat: "no-repeat",
              }}
              role="img"
              aria-label="Moesekai"
            />
            <span className="sr-only">Moesekai</span>
          </h1>
          <span className="text-xs text-slate-400 opacity-60 font-medium">{t("page.home.formerName")}</span>
        </div>

        {/* ─── Hero Carousel ─── */}
        <div className="w-full max-w-5xl">
          <HeroCarousel />
        </div>

        {/* ─── Latest Tabs ─── */}
        <div className="w-full max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl type-title font-bold text-primary-text opacity-80">{t("page.home.sections.latest")}</h2>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  pressable flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm whitespace-nowrap type-on-glass
                  ${activeTab === tab.id
                    ? "island-pill-active shadow-sm shadow-miku/15"
                    : "material-thin text-slate-600 dark:text-slate-300 hover:text-miku"
                  }
                `}
              >
                {tab.icon}
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="text-left">
            <Suspense fallback={<TabLoading />}>
              {activeTab === "event" && <CurrentEventTab />}
              {activeTab === "cards" && <LatestCardsTab />}
              {activeTab === "music" && <LatestMusicTab />}
              {activeTab === "live" && <UpcomingLiveTab />}
            </Suspense>
          </div>
        </div>

        {/* ─── Shortcuts ─── */}
        <div className="w-full max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl type-title font-bold text-primary-text opacity-80">{t("page.home.sections.shortcuts")}</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-9 gap-2">
            {SHORTCUTS.map((shortcut, index) => {
              const content = (
                <div className={`relative p-3 rounded-2xl island-panel material-regular flex flex-col items-center gap-1.5 text-center transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] group-hover:-translate-y-0.5 ${shortcut.isExternal ? "border border-[#fb7299]/30 hover:shadow-lg hover:shadow-[#fb7299]/15" : ""}`}>
                  {shortcut.badgeKey && (
                    <span className="absolute -top-1.5 -right-1 bg-[#fb7299] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-sm scale-90">
                      {t(shortcut.badgeKey)}
                    </span>
                  )}
                  <div className="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] group-hover:scale-110">
                    {shortcut.icon}
                  </div>
                  <div>
                    <h3 className={`text-xs type-on-glass font-bold leading-tight ${shortcut.isExternal ? "text-[#fb7299] group-hover:text-[#e0567e]" : "text-primary-text group-hover:text-miku"}`}>{t(shortcut.labelKey)}</h3>
                    <p className="text-[8px] type-caption text-slate-400 font-bold tracking-wider uppercase hidden sm:block">{shortcut.subLabel}</p>
                  </div>
                </div>
              );

              if (shortcut.isExternal) {
                return (
                  <ExternalLink key={index} href={shortcut.href} className="group pressable">
                    {content}
                  </ExternalLink>
                );
              }

              return (
                <Link key={index} href={shortcut.href} className="group pressable">
                  {content}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ─── Announcements ─── */}
        <div className="w-full max-w-5xl text-left space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-1 rounded-full bg-miku"></div>
              <h2 className="text-xl type-title font-bold text-primary-text opacity-80">{t("page.information.latestAnnouncements")}</h2>
            </div>
            <Link
              href="/information"
              className="pressable text-xs font-bold text-miku hover:text-miku-dark dark:hover:text-miku-light flex items-center gap-1 group/btn"
            >
              <span>{t("page.home.announcements.viewAll")}</span>
              <svg className="w-4 h-4 transform group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Scheme B: PJSK Intelligence Bureau Collaborative Banner */}
          <div className="island-panel material-regular rounded-2xl p-3.5 sm:p-4 border-l-4 border-l-[#fb7299] bg-gradient-to-r from-[#fb7299]/10 via-transparent to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden">
            <div className="flex items-start sm:items-center gap-3 min-w-0 w-full">
              <div className="w-10 h-10 rounded-xl bg-[#fb7299] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#fb7299]/25">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4.977 3.561a1.31 1.31 0 111.818-1.884l2.828 2.728c.08.078.149.163.205.254h4.277a1.32 1.32 0 01.205-.254l2.828-2.728a1.31 1.31 0 011.818 1.884L17.82 4.66h.848A5.333 5.333 0 0124 9.992v7.34a5.333 5.333 0 01-5.333 5.334H5.333A5.333 5.333 0 010 17.333V9.992a5.333 5.333 0 015.333-5.333h.781L4.977 3.56zm.356 3.67a2.667 2.667 0 00-2.666 2.667v7.529a2.667 2.667 0 002.666 2.666h13.334a2.667 2.667 0 002.666-2.666v-7.53a2.667 2.667 0 00-2.666-2.666H5.333zm1.334 5.192a1.333 1.333 0 112.666 0v1.192a1.333 1.333 0 11-2.666 0v-1.192zM16 11.09c-.736 0-1.333.597-1.333 1.333v1.192a1.333 1.333 0 102.666 0v-1.192c0-.736-.597-1.333-1.333-1.333z"
                  />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-primary-text">{t("page.home.announcements.bilibiliTitle")}</span>
                  <span className="bg-[#fb7299]/15 text-[#fb7299] text-[10px] font-black px-1.5 py-0.5 rounded">
                    {t("page.home.announcements.bilibiliBadge")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug break-words">
                  {t("page.home.announcements.bilibiliDescription")}
                </p>
              </div>
            </div>
            <ExternalLink
              href={MOESEKAI_BILIBILI_SPACE_URL}
              className="pressable shrink-0 text-xs font-bold bg-[#fb7299] hover:bg-[#e0567e] text-white px-3.5 py-2 rounded-xl shadow-sm shadow-[#fb7299]/30 flex items-center gap-1.5 transition-all self-start sm:self-auto"
            >
              <span>{t("page.home.announcements.bilibiliAction")}</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </ExternalLink>
          </div>

          <AnnouncementSection />
        </div>

        {/* ─── Birthdays / Anniversaries ─── */}
        <BirthdaySection />

        {/* ─── Friend Links ─── */}
        <div className="w-full max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl type-title font-bold text-primary-text opacity-80">{t("page.home.sections.friends")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Scheme A: Bilibili Intelligence Bureau Card */}
            <ExternalLink
              href={MOESEKAI_BILIBILI_SPACE_URL}
              target="_blank"
              className="pressable relative group overflow-hidden rounded-2xl h-16 island-panel material-regular border border-[#fb7299]/30 bg-gradient-to-br from-transparent to-[#fb7299]/5 hover:border-[#fb7299]/60 hover:shadow-lg hover:shadow-[#fb7299]/15 transition-all"
            >
              <div className="relative z-10 h-full flex items-center justify-between px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#fb7299]/15 text-[#fb7299] flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-[#fb7299] group-hover:text-white transition-all duration-300">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M4.977 3.561a1.31 1.31 0 111.818-1.884l2.828 2.728c.08.078.149.163.205.254h4.277a1.32 1.32 0 01.205-.254l2.828-2.728a1.31 1.31 0 011.818 1.884L17.82 4.66h.848A5.333 5.333 0 0124 9.992v7.34a5.333 5.333 0 01-5.333 5.334H5.333A5.333 5.333 0 010 17.333V9.992a5.333 5.333 0 015.333-5.333h.781L4.977 3.56zm.356 3.67a2.667 2.667 0 00-2.666 2.667v7.529a2.667 2.667 0 002.666 2.666h13.334a2.667 2.667 0 002.666-2.666v-7.53a2.667 2.667 0 00-2.666-2.666H5.333zm1.334 5.192a1.333 1.333 0 112.666 0v1.192a1.333 1.333 0 11-2.666 0v-1.192zM16 11.09c-.736 0-1.333.597-1.333 1.333v1.192a1.333 1.333 0 102.666 0v-1.192c0-.736-.597-1.333-1.333-1.333z"
                      />
                    </svg>
                  </div>
                  <div className="text-left min-w-0">
                    <h3 className="text-sm type-title font-bold text-primary-text group-hover:text-[#fb7299] transition-colors truncate">
                      {t("page.home.friends.bilibiliTitle")}
                    </h3>
                    <p className="text-[9px] type-caption text-slate-400 font-bold uppercase tracking-wider truncate">
                      BILIBILI
                    </p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-[#fb7299] transform group-hover:translate-x-0.5 transition-all shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </ExternalLink>

            <ExternalLink href="https://haruki.seiunx.com" target="_blank" className="pressable relative group overflow-hidden rounded-2xl h-16 island-panel material-regular">
              <div className="relative z-10 h-full flex items-center justify-between px-4">
                <div className="text-left min-w-0">
                  <h3 className="text-sm type-title font-bold text-primary-text truncate">{t("page.home.friends.harukiTitle")}</h3>
                  <p className="text-[9px] type-caption text-slate-400 font-bold uppercase tracking-wider truncate">Haruki Toolbox</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-miku shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </ExternalLink>

            <ExternalLink href="https://viewer.unipjsk.com" target="_blank" className="pressable relative group overflow-hidden rounded-2xl h-16 island-panel material-regular">
              <div className="relative z-10 h-full flex items-center justify-between px-4">
                <div className="text-left min-w-0">
                  <h3 className="text-sm type-title font-bold text-primary-text truncate">Uni Viewer</h3>
                  <p className="text-[9px] type-caption text-slate-400 font-bold uppercase tracking-wider truncate">Uni PJSK</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-miku shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </ExternalLink>

            <ExternalLink href="https://3-3.dev" target="_blank" className="pressable relative group overflow-hidden rounded-2xl h-16 island-panel material-regular">
              <div className="relative z-10 h-full flex items-center justify-between px-4">
                <div className="text-left min-w-0">
                  <h3 className="text-sm type-title font-bold text-primary-text truncate">33kit</h3>
                  <p className="text-[9px] type-caption text-slate-400 font-bold uppercase tracking-wider truncate">3-3.dev</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-miku shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </ExternalLink>
          </div>
        </div>

        {/* ─── Credits ─── */}
        <div className="w-full max-w-5xl pt-6 border-t border-slate-200/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t("page.home.sections.specialThanks")}</h2>
            <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center text-sm">
              <span className="text-slate-400">{t("page.home.specialThanksPrefix")}</span>
              <ExternalLink href="https://github.com/MejiroRina" target="_blank" className="font-bold text-slate-500 hover:text-miku transition-colors">{t("page.home.specialThanksHaruki")}</ExternalLink>
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
