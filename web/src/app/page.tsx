"use client";
import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import SetupGuide from "@/components/home/SetupGuide";
import MainLayout from "@/components/MainLayout";
import ExternalLink from "@/components/ExternalLink";
import HeroCarousel from "@/components/home/HeroCarousel";
import CurrentEventTab from "@/components/home/CurrentEventTab";
import LatestCardsTab from "@/components/home/LatestCardsTab";
import LatestMusicTab from "@/components/home/LatestMusicTab";
import UpcomingLiveTab from "@/components/home/UpcomingLiveTab";
import BilibiliDynamicTab from "@/components/home/BilibiliDynamicTab";
import BirthdaySection from "@/components/home/BirthdaySection";
import { MOE_LOGO_URL } from "@/lib/assets";
import { useI18n } from "@/contexts/I18nContext";
import { motion, AnimatePresence } from "framer-motion";

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
];

export default function Home() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>("event");
  const [showSetup, setShowSetup] = useState(false);
  const [showSettingsHint, setShowSettingsHint] = useState(false);

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
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] w-[90%] max-w-md bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 p-4 rounded-2xl shadow-xl flex items-center gap-3 text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-miku/15 dark:bg-miku/20 flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div className="flex-1 pr-2">
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                {t("page.setup.settingsHint")}
              </p>
            </div>
            <button
              onClick={() => setShowSettingsHint(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer shrink-0"
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
            <h2 className="text-xl font-bold text-primary-text opacity-80">{t("page.home.sections.latest")}</h2>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
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
            <h2 className="text-xl font-bold text-primary-text opacity-80">{t("page.home.sections.shortcuts")}</h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {SHORTCUTS.map((shortcut, index) => (
              <Link key={index} href={shortcut.href} className="group">
                <div className="p-3 rounded-xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-white/40 flex flex-col items-center gap-1.5 text-center">
                  <div className="transition-transform duration-300 group-hover:scale-110">
                    {shortcut.icon}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-primary-text group-hover:text-miku transition-colors leading-tight">{t(shortcut.labelKey)}</h3>
                    <p className="text-[8px] text-slate-400 font-bold tracking-wider uppercase hidden sm:block">{shortcut.subLabel}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── Bilibili Dynamics ─── */}
        <div className="w-full max-w-5xl text-left">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl font-bold text-primary-text opacity-80">{t("page.home.sections.dynamics")}</h2>
          </div>
          <BilibiliDynamicTab />
        </div>

        {/* ─── Birthdays / Anniversaries ─── */}
        <BirthdaySection />

        {/* ─── Friend Links ─── */}
        <div className="w-full max-w-5xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 rounded-full bg-miku"></div>
            <h2 className="text-xl font-bold text-primary-text opacity-80">{t("page.home.sections.friends")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ExternalLink href="https://haruki.seiunx.com" target="_blank" className="relative group overflow-hidden rounded-xl h-16 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-5">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-primary-text">{t("page.home.friends.harukiTitle")}</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Haruki Toolbox</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </ExternalLink>

            <ExternalLink href="https://viewer.unipjsk.com" target="_blank" className="relative group overflow-hidden rounded-xl h-16 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-5">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-primary-text">Uni Viewer</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Uni PJSK</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </ExternalLink>

            <ExternalLink href="https://3-3.dev" target="_blank" className="relative group overflow-hidden rounded-xl h-16 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-5">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-primary-text">33kit</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">3-3.dev</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
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
