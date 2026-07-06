"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme, type ServerSourceType, type AssetSourceType, type BackgroundAnimationBudget, CHAR_COLORS } from "@/contexts/ThemeContext";
import { useI18n } from "@/contexts/I18nContext";
import { getCharacterName, SUPPORTED_UI_LOCALES, UI_LOCALE_LABELS, UI_LOCALE_STORAGE_KEY, detectBrowserUiLocale, type UiLocale } from "@/lib/i18n";
import { MOE_LOGO_URL } from "@/lib/assets";
import { motion, AnimatePresence } from "framer-motion";

// Character subset for theme selection
// Full character list for theme selection
const SELECTED_THEME_CHARACTERS = [
  // Virtual Singers
  { id: "21" }, { id: "22" }, { id: "23" }, { id: "24" }, { id: "25" }, { id: "26" },
  // Leo/need
  { id: "1" }, { id: "2" }, { id: "3" }, { id: "4" },
  // MORE MORE JUMP!
  { id: "5" }, { id: "6" }, { id: "7" }, { id: "8" },
  // Vivid BAD SQUAD
  { id: "9" }, { id: "10" }, { id: "11" }, { id: "12" },
  // Wonderlands x Showtime
  { id: "13" }, { id: "14" }, { id: "15" }, { id: "16" },
  // 25-ji
  { id: "17" }, { id: "18" }, { id: "19" }, { id: "20" }
];

const BACKGROUND_ANIMATION_BUDGET_OPTIONS: { id: BackgroundAnimationBudget; labelKey: string; descriptionKey: string }[] = [
  {
    id: "on",
    labelKey: "settings.backgroundAnimationBudget.on",
    descriptionKey: "settings.backgroundAnimationBudget.onDescription",
  },
  {
    id: "off",
    labelKey: "settings.backgroundAnimationBudget.off",
    descriptionKey: "settings.backgroundAnimationBudget.offDescription",
  },
];

// Helper to measure latency to a CDN server
const pingServer = async (url: string): Promise<number> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

  const start = performance.now();
  try {
    await fetch(`${url}?t=${Date.now()}`, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
    });
    const duration = performance.now() - start;
    clearTimeout(timeoutId);
    return Math.round(duration);
  } catch (_err) {
    clearTimeout(timeoutId);
    return 9999; // Return high latency for failed pings
  }
};

const SETUP_STORAGE_KEYS = {
  completed: "moesekai_setup_completed",
  inProgress: "moesekai_setup_in_progress",
  step: "moesekai_setup_step",
} as const;

function getLanguageGuideCopy(t: (key: string) => string, locale: UiLocale) {
  return {
    title: t("page.setup.languageBilingualTitle"),
    description: t("page.setup.languageBilingualDesc"),
    subtitle: t(`page.setup.languageOptionSubtitles.${locale}`),
  };
}

// Hello greetings list to cycle in Step 0
const GREETINGS = [
  "Hello",       // English
  "\u4f60\u597d", // Chinese
  "こんにちは",  // Japanese
  "Bonjour",     // French
  "Hola",        // Spanish
  "Ciao",        // Italian
  "Hallo",       // German
  "안녕하세요",    // Korean
];

interface SetupGuideProps {
  onComplete?: (showHint: boolean) => void;
}

export default function SetupGuide({ onComplete }: SetupGuideProps) {
  const { t, locale, setLocale } = useI18n();
  const {
    themeCharId,
    themeColor,
    setThemeCharacter,
    colorSchemePreference,
    setColorSchemePreference,
    backgroundAnimationBudget,
    setBackgroundAnimationBudget,
    isShowSpoiler,
    setShowSpoiler,
    useTrainedThumbnail,
    setUseTrainedThumbnail,
    assetSource,
    setAssetSource,
    serverSource,
    setServerSource,
    useLLMTranslation,
    setUseLLMTranslation,
  } = useTheme();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [pings, setPings] = useState<Record<string, number | null>>({
    main: null,
    overseas: null
  });
  const [isPinging, setIsPinging] = useState(false);

  // Defer mounting to avoid SSR hydration mismatches
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);

      const completed = localStorage.getItem(SETUP_STORAGE_KEYS.completed) === "true";
      const inProgress = localStorage.getItem(SETUP_STORAGE_KEYS.inProgress);
      const savedStep = localStorage.getItem(SETUP_STORAGE_KEYS.step);
      const savedLocale = localStorage.getItem(UI_LOCALE_STORAGE_KEY);

      if (!completed && !savedLocale) {
        setLocale((currentLocale) => detectBrowserUiLocale(currentLocale));
      }

      if (inProgress === "true" && savedStep) {
        setCurrentStep(Number(savedStep));
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [setLocale]);

  // Sync step changes to localStorage in case of page reload/refresh
  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    if (step > 0 && step < 6) {
      localStorage.setItem(SETUP_STORAGE_KEYS.inProgress, "true");
      localStorage.setItem(SETUP_STORAGE_KEYS.step, String(step));
    }
  };

  // Cycle through greetings in Step 0
  useEffect(() => {
    if (currentStep !== 0) return;
    const interval = setInterval(() => {
      setGreetingIndex((prev) => (prev + 1) % GREETINGS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [currentStep]);

  // Assets latency ping test & auto-selection
  useEffect(() => {
    if (currentStep !== 3 || isPinging || (pings.main !== null && pings.overseas !== null)) return;

    const runPingTest = async () => {
      setIsPinging(true);
      const [mainPing, overseasPing] = await Promise.all([
        pingServer("https://storage.exmeaning.com"),
        pingServer("https://storage.pjsk.moe")
      ]);

      setPings({
        main: mainPing,
        overseas: overseasPing
      });
      setIsPinging(false);

      // Auto select the route with the lower latency
      const preferredType = mainPing <= overseasPing ? "main" : "overseas";
      setAssetSource(preferredType as AssetSourceType);
    };

    runPingTest();
  }, [currentStep, pings, isPinging, setAssetSource]);

  if (!mounted || isExiting) return null;

  // Render check for completed setup
  const isCompleted = localStorage.getItem(SETUP_STORAGE_KEYS.completed) === "true";
  if (isCompleted) return null;

  const completeSetup = () => {
    setIsExiting(true);
    localStorage.setItem(SETUP_STORAGE_KEYS.completed, "true");
    localStorage.removeItem(SETUP_STORAGE_KEYS.inProgress);
    localStorage.removeItem(SETUP_STORAGE_KEYS.step);
    onComplete?.(true);
  };

  const handleFinish = () => {
    completeSetup();
  };

  const handleSkip = () => {
    completeSetup();
  };

  const languageCopy = getLanguageGuideCopy(t, locale);

  // iOS-style container variants
  const slideVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
    exit: { opacity: 0, x: -50, transition: { duration: 0.2 } }
  };

  // Drifting colorful blobs styling for mesh background
  const meshStyles = `
    @keyframes driftBlob1 {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(40px, -60px) scale(1.15); }
      66% { transform: translate(-30px, 30px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes driftBlob2 {
      0% { transform: translate(0px, 0px) scale(1); }
      50% { transform: translate(-50px, 50px) scale(1.1); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes driftBlob3 {
      0% { transform: translate(0px, 0px) scale(1); }
      40% { transform: translate(60px, 40px) scale(0.95); }
      80% { transform: translate(-20px, -40px) scale(1.05); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .drift-blob-1 { animation: driftBlob1 25s infinite ease-in-out; }
    .drift-blob-2 { animation: driftBlob2 20s infinite ease-in-out; }
    .drift-blob-3 { animation: driftBlob3 22s infinite ease-in-out; }
  `;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-2xl p-0 sm:p-6 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: meshStyles }} />

      {/* Main setup container: Card on desktop, Full screen on mobile */}
      <div className="relative w-full h-full sm:max-w-md sm:h-[720px] rounded-none sm:rounded-3xl border-0 sm:border border-white/20 shadow-none sm:shadow-2xl overflow-hidden bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl flex flex-col justify-between p-6 sm:p-8 text-slate-800 dark:text-slate-100 transition-all duration-300">
        
        {/* Shifting Mesh Gradient Background */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none opacity-40 dark:opacity-30">
          <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-miku/30 blur-[80px] drift-blob-1" style={{ backgroundColor: `${themeColor}40` }} />
          <div className="absolute top-[40%] -right-[15%] w-[70%] h-[75%] rounded-full bg-pink-400/25 blur-[100px] drift-blob-2" />
          <div className="absolute -bottom-[10%] left-[20%] w-[55%] h-[55%] rounded-full bg-yellow-300/20 blur-[80px] drift-blob-3" />
        </div>

        {/* ─── Top Header (Step counter & branding) ─── */}
        <div className="flex items-center justify-between w-full h-8 z-10">
          {currentStep > 0 && currentStep < 6 ? (
            <button
              onClick={() => handleStepChange(currentStep - 1)}
              className="flex items-center gap-1 text-sm font-semibold transition-all hover:opacity-80"
              style={{ color: themeColor }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              {t("page.setup.back")}
            </button>
          ) : (
            <div />
          )}

          {currentStep > 0 && currentStep < 6 && (
            <span className="text-xs font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {t("page.setup.stepIndicator", { current: String(currentStep), total: "5" })}
            </span>
          )}
          {currentStep < 6 ? (
            <button
              onClick={handleSkip}
              className="text-xs font-bold tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase cursor-pointer"
            >
              {currentStep <= 1 ? t("page.setup.skipBilingual") : t("page.setup.skip")}
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* ─── Step Contents (framer-motion animated) ─── */}
        <div className="flex-1 flex flex-col justify-center my-4 sm:my-6 overflow-y-auto px-1 z-10 select-none">
          <AnimatePresence mode="wait">
            
            {/* STEP 0: Hello & Moesekai branding */}
            {currentStep === 0 && (
              <motion.div
                key="step0"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col items-center justify-center text-center space-y-6"
              >
                {/* Greeting animation */}
                <div className="h-16 flex items-center justify-center">
                  <motion.h1
                    key={greetingIndex}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.4 }}
                    className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-miku to-miku-dark bg-clip-text text-transparent filter drop-shadow-sm font-sans"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${themeColor}, var(--color-miku-dark, ${themeColor}))`
                    }}
                  >
                    {GREETINGS[greetingIndex]}
                  </motion.h1>
                </div>

                {/* Brand Logo & Name */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="h-12 w-44 bg-gradient-to-r transition-all duration-300"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${themeColor}, var(--color-miku-dark, ${themeColor}))`,
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
                    aria-label="Moesekai Logo"
                  />
                  <h2 className="text-xl font-bold tracking-wide text-slate-800 dark:text-slate-100 mt-1">
                    Moesekai
                  </h2>
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {t("page.home.formerName")}
                  </p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {t("page.setup.welcomeBilingual")}
                  </p>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed whitespace-pre-line">
                  {t("page.setup.welcomeBilingualDesc")}
                </p>
              </motion.div>
            )}

            {/* STEP 1: Language Selector */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col space-y-5"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    {languageCopy.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {languageCopy.description}
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  {SUPPORTED_UI_LOCALES.map((l) => {
                    const isSelected = locale === l;
                    return (
                      <button
                        key={l}
                        onClick={() => {
                          setLocale(l);
                          if (l !== "zh-CN") {
                            setUseLLMTranslation(false);
                          }
                          handleStepChange(2);
                        }}
                        className={`w-full p-4 rounded-2xl flex items-center justify-between border text-left font-bold transition-all duration-300 ${
                          isSelected
                            ? "bg-white dark:bg-slate-800 shadow-md scale-[1.01]"
                            : "bg-white/40 dark:bg-slate-900/30 hover:bg-white/60 dark:hover:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/40"
                        }`}
                        style={{
                          borderColor: isSelected ? themeColor : undefined,
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-base text-slate-800 dark:text-slate-100">
                            {UI_LOCALE_LABELS[l]}
                          </span>
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            {getLanguageGuideCopy(t, l).subtitle}
                          </span>
                        </div>
                        {isSelected && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={themeColor} strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 dark:border-amber-900/30 px-2.5 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-500">
                  <span className="mt-0.5 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-900/50 text-[8px] font-black text-amber-700 dark:text-amber-500">!</span>
                  <span>{t("settings.uiLanguage.machineTranslationNotice")}</span>
                </p>
              </motion.div>
            )}

            {/* STEP 2: Data Server Source */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col space-y-5"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    {t("page.setup.serverTitle")}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("page.setup.serverDesc")}
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2 max-h-[360px] overflow-y-auto pr-1">
                  {(["jp", "cn", "en", "tw", "kr"] as ServerSourceType[]).map((srv) => {
                    const isSelected = serverSource === srv;
                    const serverDescriptions: Record<ServerSourceType, string> = {
                      en: "Global Event Schedule & Masterdata",
                      jp: "JP Event Schedule & Masterdata",
                      cn: "CN Event Schedule & Masterdata",
                      tw: "TW Event Schedule & Masterdata",
                      kr: "KR Event Schedule & Masterdata"
                    };
                    return (
                      <button
                        key={srv}
                        onClick={() => {
                          setServerSource(srv);
                          handleStepChange(3);
                        }}
                        className={`w-full p-4 rounded-2xl flex items-center justify-between border text-left font-bold transition-all duration-300 shrink-0 ${
                          isSelected
                            ? "bg-white dark:bg-slate-800 shadow-md scale-[1.01]"
                            : "bg-white/40 dark:bg-slate-900/30 hover:bg-white/60 dark:hover:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/40"
                        }`}
                        style={{
                          borderColor: isSelected ? themeColor : undefined,
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-base text-slate-800 dark:text-slate-100">
                            {t("settings.serverSource." + srv)}
                          </span>
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            {serverDescriptions[srv]}
                          </span>
                        </div>
                        {isSelected && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={themeColor} strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 3: Assets Route (only main and overseas main) */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col space-y-5"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    {t("page.setup.assetTitle")}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("page.setup.assetDesc")}
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  {[
                    { type: "main" as AssetSourceType, label: t("page.setup.assetMain"), desc: "Primary CDN optimized for loading speeds" },
                    { type: "overseas" as AssetSourceType, label: t("page.setup.assetOverseas"), desc: "Global CDN fallback for overseas connections" }
                  ].map((assetOpt) => {
                    const isSelected = assetSource === assetOpt.type;
                    return (
                      <button
                        key={assetOpt.type}
                        onClick={() => {
                          setAssetSource(assetOpt.type);
                          handleStepChange(4);
                        }}
                        className={`w-full p-4 rounded-2xl flex items-center justify-between border text-left font-bold transition-all duration-300 ${
                          isSelected
                            ? "bg-white dark:bg-slate-800 shadow-md scale-[1.01]"
                            : "bg-white/40 dark:bg-slate-900/30 hover:bg-white/60 dark:hover:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/40"
                        }`}
                        style={{
                          borderColor: isSelected ? themeColor : undefined,
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {assetOpt.label}
                            {assetOpt.type.startsWith("main") ? (
                              pings.main === null ? (
                                isPinging ? (
                                  <span className="text-[10px] text-slate-400 font-normal animate-pulse">({t("page.setup.testingPing")})</span>
                                ) : null
                              ) : (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  pings.main === 9999
                                    ? "text-red-500 bg-red-500/10 border-red-500/20"
                                    : pings.main < 100
                                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                                    : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                                }`}>
                                  {pings.main === 9999 ? t("page.setup.timeout") : `${pings.main} ms`}
                                </span>
                              )
                            ) : (
                              pings.overseas === null ? (
                                isPinging ? (
                                  <span className="text-[10px] text-slate-400 font-normal animate-pulse">({t("page.setup.testingPing")})</span>
                                ) : null
                              ) : (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  pings.overseas === 9999
                                    ? "text-red-500 bg-red-500/10 border-red-500/20"
                                    : pings.overseas < 100
                                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                                    : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                                }`}>
                                  {pings.overseas === 9999 ? t("page.setup.timeout") : `${pings.overseas} ms`}
                                </span>
                              )
                            )}
                          </span>
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            {assetOpt.desc}
                          </span>
                        </div>
                        {isSelected && (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={themeColor} strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 4: Appearance & Character Theme Color Selection */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    {t("page.setup.themeTitle")}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {t("page.setup.themeDesc")}
                  </p>
                </div>

                {/* Appearance cards */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t("page.setup.appearanceTitle")}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "light" as const, label: t("page.setup.appearanceMockLight"), bg: "bg-slate-100 border-slate-200 text-slate-800" },
                      { id: "dark" as const, label: t("page.setup.appearanceMockDark"), bg: "bg-slate-950 border-slate-800 text-slate-200" },
                      { id: "system" as const, label: t("page.setup.appearanceMockSystem"), bg: "bg-gradient-to-r from-slate-100 to-slate-950 border-slate-300 text-slate-500" }
                    ].map((pref) => {
                      const isSelected = colorSchemePreference === pref.id;
                      return (
                        <button
                          key={pref.id}
                          onClick={() => setColorSchemePreference(pref.id)}
                          className={`p-3 rounded-xl border text-center transition-all duration-300 flex flex-col items-center gap-1.5 ${pref.bg} ${
                            isSelected ? "ring-2 scale-[1.02] shadow-sm font-bold" : "opacity-75 hover:opacity-100"
                          }`}
                          style={{
                            boxShadow: isSelected ? `0 0 0 2px ${themeColor}` : undefined,
                            borderColor: isSelected ? themeColor : undefined,
                          }}
                        >
                          <div className="w-8 h-4 rounded bg-white/20 border border-white/10" />
                          <span className="text-[10px] leading-none truncate w-full">{pref.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Background animation budget */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t("page.setup.backgroundAnimationTitle")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {BACKGROUND_ANIMATION_BUDGET_OPTIONS.map((option) => {
                      const isSelected = backgroundAnimationBudget === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setBackgroundAnimationBudget(option.id)}
                          className={`p-3 rounded-xl border text-center transition-all duration-300 flex flex-col items-center gap-1 ${
                            isSelected
                              ? "bg-white dark:bg-slate-800 shadow-md scale-[1.02] font-bold"
                              : "bg-white/40 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 opacity-75 hover:opacity-100"
                          }`}
                          style={{
                            boxShadow: isSelected ? `0 0 0 2px ${themeColor}` : undefined,
                            borderColor: isSelected ? themeColor : undefined,
                          }}
                        >
                          <span className="text-[11px] leading-none truncate w-full text-slate-700 dark:text-slate-100">
                            {t(option.labelKey)}
                          </span>
                          <span className="text-[9px] leading-tight text-slate-400 dark:text-slate-500 line-clamp-2">
                            {t(option.descriptionKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Theme character color scroll list */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t("page.setup.themeColorTitle")}
                  </h3>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
                    {SELECTED_THEME_CHARACTERS.map((char) => {
                      const color = CHAR_COLORS[char.id];
                      const isSelected = themeCharId === char.id;
                      const charName = getCharacterName(t, Number(char.id), "short");
                      return (
                        <button
                          key={char.id}
                          onClick={() => setThemeCharacter(char.id)}
                          className={`flex flex-col items-center gap-1 shrink-0 p-2.5 rounded-2xl transition-all duration-300 border ${
                            isSelected
                              ? "bg-white dark:bg-slate-800 shadow-md scale-105"
                              : "bg-white/40 dark:bg-slate-900/30 border-transparent hover:bg-white/60"
                          }`}
                          style={{
                            borderColor: isSelected ? themeColor : "transparent",
                          }}
                        >
                          <span
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm transition-transform duration-300"
                            style={{
                              backgroundColor: color,
                            }}
                          >
                            {isSelected && (
                              <svg className="w-5 h-5 text-white filter drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {charName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 5: Content Preferences */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col space-y-5"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    {t("page.setup.contentTitle")}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t("page.setup.contentDesc")}
                  </p>
                </div>

                <div className="flex flex-col bg-white/40 dark:bg-slate-900/30 rounded-3xl border border-slate-200/50 dark:border-slate-800/40 divide-y divide-slate-200/50 dark:divide-slate-800/40">
                  {/* Spoiler toggle */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex flex-col pr-4 text-left">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {t("settings.showSpoiler.label")}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {t("settings.showSpoiler.description")}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowSpoiler(!isShowSpoiler)}
                      className="w-12 h-7 rounded-full transition-colors relative duration-200 shrink-0"
                      style={{
                        backgroundColor: isShowSpoiler ? themeColor : "var(--color-slate-200, #cbd5e1)",
                      }}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${isShowSpoiler ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  {/* Trained thumbnail toggle */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex flex-col pr-4 text-left">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {t("settings.trainedThumbnail.label")}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {t("settings.trainedThumbnail.description")}
                      </span>
                    </div>
                    <button
                      onClick={() => setUseTrainedThumbnail(!useTrainedThumbnail)}
                      className="w-12 h-7 rounded-full transition-colors relative duration-200 shrink-0"
                      style={{
                        backgroundColor: useTrainedThumbnail ? themeColor : "var(--color-slate-200, #cbd5e1)",
                      }}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${useTrainedThumbnail ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>

                  {/* LLM translation toggle — only shown when locale is zh-CN */}
                  {locale === "zh-CN" && (
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex flex-col pr-4 text-left">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {t("settings.translation.label")}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {t("settings.translation.description")}
                        </span>
                      </div>
                      <button
                        onClick={() => setUseLLMTranslation(!useLLMTranslation)}
                        className="w-12 h-7 rounded-full transition-colors relative duration-200 shrink-0"
                        style={{
                          backgroundColor: useLLMTranslation ? themeColor : "var(--color-slate-200, #cbd5e1)",
                        }}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${useLLMTranslation ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 6: Activation Success */}
            {currentStep === 6 && (
              <motion.div
                key="step6"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col items-center justify-center text-center space-y-6"
              >
                {/* Huge animated checkmark circle */}
                <motion.div
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                  className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: themeColor,
                  }}
                >
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                    {t("page.setup.finishTitle")}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                    {t("page.setup.finishDesc")}
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ─── Bottom Actions (Pill buttons) ─── */}
        <div className="w-full flex flex-col gap-3 z-10">
          {currentStep === 0 ? (
            <button
              onClick={() => handleStepChange(1)}
              className="w-full py-4 px-6 rounded-2xl text-base font-bold text-white shadow-lg shadow-miku/20 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              style={{
                backgroundImage: `linear-gradient(to right, ${themeColor}, var(--color-miku-dark, ${themeColor}))`,
                boxShadow: `0 8px 24px -4px ${themeColor}40`,
              }}
            >
              {t("page.setup.getStartedBilingual")}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : currentStep === 6 ? (
            <button
              onClick={handleFinish}
              className="w-full py-4 px-6 rounded-2xl text-base font-bold text-white shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 animate-pulse"
              style={{
                backgroundImage: `linear-gradient(to right, ${themeColor}, var(--color-miku-dark, ${themeColor}))`,
                boxShadow: `0 8px 24px -4px ${themeColor}40`,
                animationDuration: "2s",
              }}
            >
              {t("page.setup.startExploring")}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => handleStepChange(currentStep + 1)}
              className="w-full py-4 px-6 rounded-2xl text-base font-bold text-white shadow-lg hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              style={{
                backgroundImage: `linear-gradient(to right, ${themeColor}, var(--color-miku-dark, ${themeColor}))`,
                boxShadow: `0 8px 24px -4px ${themeColor}40`,
              }}
            >
              {t("page.setup.next")}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Indicator bar style */}
          <div className="flex justify-center gap-1.5 pt-2">
            {[0, 1, 2, 3, 4, 5, 6].map((stepIdx) => {
              const isActive = currentStep === stepIdx;
              return (
                <span
                  key={stepIdx}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: isActive ? "16px" : "6px",
                    backgroundColor: isActive ? themeColor : "var(--color-slate-200, #e2e8f0)",
                    opacity: isActive ? 1 : 0.4,
                  }}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
