"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CHAR_COLORS, CHAR_NAMES } from "@/types/types";
import {
    COLOR_SCHEME_STORAGE_KEY,
    DARK_MEDIA_QUERY,
    THEME_CHAR_STORAGE_KEY,
    isValidColorSchemePreference,
    resolveColorSchemePreference,
    type ColorSchemePreference,
    type ResolvedColorScheme,
} from "@/lib/colorScheme";
import {
    ADSENSE_SCRIPT_ID,
    ADSENSE_SCRIPT_SRC,
    ADS_FEATURE_ENABLED,
    DEFAULT_SHOW_ADS,
    SHOW_ADS_STORAGE_KEY,
} from "@/lib/ads";

// Default theme color (Miku)
const DEFAULT_THEME_CHAR = "21";
const DEFAULT_COLOR = "#33ccbb";
const DEFAULT_COLOR_SCHEME_PREFERENCE: ColorSchemePreference = "system";
const POWER_SAVING_STORAGE_KEY = "power-saving-v4";

// Asset source type (5 independent sources: 3 JP + 2 CN)
export type AssetSourceType = "uni" | "haruki" | "snowyassets" | "snowyassets_cn" | "haruki_cn";
const DEFAULT_ASSET_SOURCE: AssetSourceType = "snowyassets";
const CN_ASSET_SOURCES: AssetSourceType[] = ["snowyassets_cn", "haruki_cn"];
const VALID_ASSET_SOURCES: AssetSourceType[] = ["uni", "haruki", "snowyassets", "snowyassets_cn", "haruki_cn"];

// Server source type
export type ServerSourceType = "jp" | "cn";
const DEFAULT_SERVER_SOURCE: ServerSourceType = "jp";

interface ThemeContextType {
    themeCharId: string;
    themeColor: string;
    setThemeCharacter: (charId: string) => void;
    colorSchemePreference: ColorSchemePreference;
    resolvedColorScheme: ResolvedColorScheme;
    setColorSchemePreference: (preference: ColorSchemePreference) => void;
    isShowSpoiler: boolean;
    setShowSpoiler: (show: boolean) => void;
    isPowerSaving: boolean;
    setPowerSaving: (enabled: boolean) => void;
    useTrainedThumbnail: boolean;
    setUseTrainedThumbnail: (enabled: boolean) => void;
    assetSource: AssetSourceType;
    setAssetSource: (source: AssetSourceType) => void;
    useLLMTranslation: boolean;
    setUseLLMTranslation: (enabled: boolean) => void;
    showAds: boolean;
    setShowAds: (enabled: boolean) => void;
    serverSource: ServerSourceType;
    setServerSource: (source: ServerSourceType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [themeCharId, setThemeCharId] = useState<string>(DEFAULT_THEME_CHAR);
    const [themeColor, setThemeColor] = useState<string>(DEFAULT_COLOR);
    const [colorSchemePreference, setColorSchemePreferenceState] = useState<ColorSchemePreference>(DEFAULT_COLOR_SCHEME_PREFERENCE);
    const [resolvedColorScheme, setResolvedColorScheme] = useState<ResolvedColorScheme>("light");
    const [hasHydratedThemeSettings, setHasHydratedThemeSettings] = useState(false);
    const [isShowSpoiler, setIsShowSpoiler] = useState(false);
    const [isPowerSaving, setIsPowerSaving] = useState(true);
    const [useTrainedThumbnailState, setUseTrainedThumbnailState] = useState(false);
    const [assetSourceState, setAssetSourceState] = useState<AssetSourceType>(DEFAULT_ASSET_SOURCE);
    const [useLLMTranslationState, setUseLLMTranslationState] = useState(true); // Default ON
    const [showAdsState, setShowAdsState] = useState(DEFAULT_SHOW_ADS);
    const [serverSourceState, setServerSourceState] = useState<ServerSourceType>(DEFAULT_SERVER_SOURCE);
    const effectiveShowAds = ADS_FEATURE_ENABLED && showAdsState;

    // Load saved settings from localStorage on mount
    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            const savedCharId = localStorage.getItem(THEME_CHAR_STORAGE_KEY);
            if (savedCharId && CHAR_COLORS[savedCharId]) {
                setThemeCharId(savedCharId);
                setThemeColor(CHAR_COLORS[savedCharId]);
            }
            const savedColorSchemePreference = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
            if (isValidColorSchemePreference(savedColorSchemePreference)) {
                setColorSchemePreferenceState(savedColorSchemePreference);
            }
            // Load spoiler setting
            const savedSpoiler = localStorage.getItem("show-spoiler");
            if (savedSpoiler === "true") {
                setIsShowSpoiler(true);
            }
            // Load power saving setting (v4: default ON until the Rust/WASM renderer finishes real-device validation)
            const savedPowerSaving = localStorage.getItem(POWER_SAVING_STORAGE_KEY);
            if (savedPowerSaving === "false") {
                setIsPowerSaving(false);
            }
            // Load trained thumbnail setting
            const savedTrainedThumbnail = localStorage.getItem("use-trained-thumbnail");
            if (savedTrainedThumbnail === "true") {
                setUseTrainedThumbnailState(true);
            }
            // Load asset source setting
            let loadedAssetSource: AssetSourceType = DEFAULT_ASSET_SOURCE;
            const savedAssetSource = localStorage.getItem("asset-source");
            if (savedAssetSource && VALID_ASSET_SOURCES.includes(savedAssetSource as AssetSourceType)) {
                loadedAssetSource = savedAssetSource as AssetSourceType;
            }
            // Load LLM translation setting (default ON, so only turn off if explicitly "false")
            const savedLLMTranslation = localStorage.getItem("use-llm-translation");
            if (savedLLMTranslation === "false") {
                setUseLLMTranslationState(false);
            }
            // Load ads display setting
            const savedShowAds = localStorage.getItem(SHOW_ADS_STORAGE_KEY);
            if (ADS_FEATURE_ENABLED) {
                if (savedShowAds === "true") {
                    setShowAdsState(true);
                } else if (savedShowAds === "false") {
                    setShowAdsState(false);
                }
            } else {
                setShowAdsState(false);
                localStorage.setItem(SHOW_ADS_STORAGE_KEY, "false");
            }
            // Load server source setting
            const savedServerSource = localStorage.getItem("server-source");
            if (savedServerSource === "jp" || savedServerSource === "cn") {
                setServerSourceState(savedServerSource);
            }
            // When CN server is selected, ensure asset source is a CN source
            if (savedServerSource === "cn" && !CN_ASSET_SOURCES.includes(loadedAssetSource)) {
                loadedAssetSource = "snowyassets_cn";
                localStorage.setItem("asset-source", "snowyassets_cn");
            }
            // When JP server is selected, ensure asset source is NOT a CN source
            if (savedServerSource !== "cn" && CN_ASSET_SOURCES.includes(loadedAssetSource)) {
                loadedAssetSource = "snowyassets";
                localStorage.setItem("asset-source", "snowyassets");
            }
            setAssetSourceState(loadedAssetSource);
            setHasHydratedThemeSettings(true);
        });

        return () => {
            cancelAnimationFrame(raf);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || !hasHydratedThemeSettings) {
            return;
        }

        const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);

        const applyColorScheme = () => {
            const nextResolvedColorScheme = resolveColorSchemePreference(
                colorSchemePreference,
                mediaQuery.matches
            );

            setResolvedColorScheme((current) =>
                current === nextResolvedColorScheme ? current : nextResolvedColorScheme
            );

            document.documentElement.dataset.theme = nextResolvedColorScheme;
            document.documentElement.dataset.themePreference = colorSchemePreference;
            document.documentElement.style.colorScheme = nextResolvedColorScheme;
            document.documentElement.classList.toggle("dark", nextResolvedColorScheme === "dark");
        };

        applyColorScheme();

        if (colorSchemePreference !== "system") {
            return;
        }

        const handleChange = () => {
            applyColorScheme();
        };

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleChange);
            return () => mediaQuery.removeEventListener("change", handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, [colorSchemePreference, hasHydratedThemeSettings]);

    useEffect(() => {
        if (typeof document === "undefined" || !hasHydratedThemeSettings) {
            return;
        }

        document.documentElement.dataset.showAds = effectiveShowAds ? "true" : "false";

        if (!effectiveShowAds || document.getElementById(ADSENSE_SCRIPT_ID)) {
            return;
        }

        const script = document.createElement("script");
        script.id = ADSENSE_SCRIPT_ID;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.src = ADSENSE_SCRIPT_SRC;
        document.head.appendChild(script);
    }, [effectiveShowAds, hasHydratedThemeSettings]);

    // Apply theme color to CSS variables
    useEffect(() => {
        if (!hasHydratedThemeSettings) {
            return;
        }

        document.documentElement.style.setProperty("--color-miku", themeColor);
        // Also update the dark variant (darken by ~15%)
        const darkColor = darkenColor(themeColor, 15);
        document.documentElement.style.setProperty("--color-miku-dark", darkColor);

        // Update light variant for background (mix with 95% white)
        const lightColor = mixWithWhite(themeColor, 95);
        document.documentElement.style.setProperty("--theme-light", lightColor);

        // Add RGB variant for rgba usage
        const rgb = hexToRgb(themeColor);
        if (rgb) {
            document.documentElement.style.setProperty("--color-miku-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }
    }, [themeColor, hasHydratedThemeSettings]);

    const setThemeCharacter = (charId: string) => {
        if (CHAR_COLORS[charId]) {
            setThemeCharId(charId);
            setThemeColor(CHAR_COLORS[charId]);
            try {
                localStorage.setItem(THEME_CHAR_STORAGE_KEY, charId);
            } catch (e) {
                console.error("Failed to save theme to localStorage:", e);
            }
        } else {
            console.warn("Invalid character ID for theme:", charId);
        }
    };

    const setColorSchemePreference = (preference: ColorSchemePreference) => {
        setColorSchemePreferenceState(preference);

        try {
            localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, preference);
        } catch (e) {
            console.error("Failed to save color scheme preference to localStorage:", e);
        }
    };

    const setShowSpoiler = (show: boolean) => {
        setIsShowSpoiler(show);
        try {
            localStorage.setItem("show-spoiler", show ? "true" : "false");
        } catch (e) {
            console.error("Failed to save spoiler setting to localStorage:", e);
        }
    };

    const setPowerSaving = (enabled: boolean) => {
        setIsPowerSaving(enabled);
        try {
            localStorage.setItem(POWER_SAVING_STORAGE_KEY, enabled ? "true" : "false");
        } catch (e) {
            console.error("Failed to save power saving setting to localStorage:", e);
        }
    };

    const setUseTrainedThumbnail = (enabled: boolean) => {
        setUseTrainedThumbnailState(enabled);
        try {
            localStorage.setItem("use-trained-thumbnail", enabled ? "true" : "false");
        } catch (e) {
            console.error("Failed to save trained thumbnail setting to localStorage:", e);
        }
    };

    const setAssetSource = (source: AssetSourceType) => {
        setAssetSourceState(source);
        try {
            localStorage.setItem("asset-source", source);
        } catch (e) {
            console.error("Failed to save asset source setting to localStorage:", e);
        }
    };

    const setUseLLMTranslation = (enabled: boolean) => {
        setUseLLMTranslationState(enabled);
        try {
            localStorage.setItem("use-llm-translation", enabled ? "true" : "false");
        } catch (e) {
            console.error("Failed to save LLM translation setting to localStorage:", e);
        }
    };

    const setShowAds = (enabled: boolean) => {
        if (!ADS_FEATURE_ENABLED) {
            setShowAdsState(false);
            try {
                localStorage.setItem(SHOW_ADS_STORAGE_KEY, "false");
            } catch (e) {
                console.error("Failed to save ads display setting to localStorage:", e);
            }
            return;
        }

        setShowAdsState(enabled);
        try {
            localStorage.setItem(SHOW_ADS_STORAGE_KEY, enabled ? "true" : "false");
        } catch (e) {
            console.error("Failed to save ads display setting to localStorage:", e);
        }
    };

    const setServerSource = (source: ServerSourceType) => {
        setServerSourceState(source);
        try {
            localStorage.setItem("server-source", source);
        } catch (e) {
            console.error("Failed to save server source setting to localStorage:", e);
        }
        // Auto-map asset source when switching servers
        if (source === "cn") {
            // Map JP sources → CN equivalents
            const sourceMap: Record<string, AssetSourceType> = {
                "snowyassets": "snowyassets_cn",
                "haruki": "haruki_cn",
                "uni": "snowyassets_cn", // Uni has no CN equivalent, default to Snowy CN
            };
            const newAsset = sourceMap[assetSourceState] || "snowyassets_cn";
            setAssetSource(newAsset);
        } else {
            // Map CN sources → JP equivalents
            const sourceMap: Record<string, AssetSourceType> = {
                "snowyassets_cn": "snowyassets",
                "haruki_cn": "haruki",
            };
            if (sourceMap[assetSourceState]) {
                setAssetSource(sourceMap[assetSourceState]);
            }
        }
    };

    return (
        <ThemeContext.Provider value={{ themeCharId, themeColor, setThemeCharacter, colorSchemePreference, resolvedColorScheme, setColorSchemePreference, isShowSpoiler, setShowSpoiler, isPowerSaving, setPowerSaving, useTrainedThumbnail: useTrainedThumbnailState, setUseTrainedThumbnail, assetSource: assetSourceState, setAssetSource, useLLMTranslation: useLLMTranslationState, setUseLLMTranslation, showAds: effectiveShowAds, setShowAds, serverSource: serverSourceState, setServerSource }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}

// Helper function to darken a hex color
function darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max(((num >> 8) & 0x00ff) - amt, 0);
    const B = Math.max((num & 0x0000ff) - amt, 0);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Helper function to mix a color with white (tint)
function mixWithWhite(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const R = (num >> 16) & 0xff;
    const G = (num >> 8) & 0xff;
    const B = num & 0xff;

    // Mix with white (255, 255, 255)
    // percent is chance of white (0-100)
    const factor = percent / 100;

    const newR = Math.round(R * (1 - factor) + 255 * factor);
    const newG = Math.round(G * (1 - factor) + 255 * factor);
    const newB = Math.round(B * (1 - factor) + 255 * factor);

    return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

// Helper: Hex to RGB object
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Export character data for use in settings
export { CHAR_NAMES, CHAR_COLORS };
