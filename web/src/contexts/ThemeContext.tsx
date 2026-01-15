"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CHAR_COLORS, CHAR_NAMES } from "@/types/types";

// Default theme color (Miku)
const DEFAULT_THEME_CHAR = "21";
const DEFAULT_COLOR = "#33ccbb";

// Asset source type
export type AssetSourceType = "uni" | "haruki";
const DEFAULT_ASSET_SOURCE: AssetSourceType = "uni";

interface ThemeContextType {
    themeCharId: string;
    themeColor: string;
    setThemeCharacter: (charId: string) => void;
    isShowSpoiler: boolean;
    setShowSpoiler: (show: boolean) => void;
    isPowerSaving: boolean;
    setPowerSaving: (enabled: boolean) => void;
    useTrainedThumbnail: boolean;
    setUseTrainedThumbnail: (enabled: boolean) => void;
    assetSource: AssetSourceType;
    setAssetSource: (source: AssetSourceType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [themeCharId, setThemeCharId] = useState<string>(DEFAULT_THEME_CHAR);
    const [themeColor, setThemeColor] = useState<string>(DEFAULT_COLOR);
    const [isShowSpoiler, setIsShowSpoiler] = useState(false);
    const [isPowerSaving, setIsPowerSaving] = useState(false);
    const [useTrainedThumbnailState, setUseTrainedThumbnailState] = useState(false);
    const [assetSourceState, setAssetSourceState] = useState<AssetSourceType>(DEFAULT_ASSET_SOURCE);
    const [mounted, setMounted] = useState(false);

    // Load saved settings from localStorage on mount
    useEffect(() => {
        setMounted(true);
        const savedCharId = localStorage.getItem("theme-char-id");
        if (savedCharId && CHAR_COLORS[savedCharId]) {
            setThemeCharId(savedCharId);
            setThemeColor(CHAR_COLORS[savedCharId]);
        }
        // Load spoiler setting
        const savedSpoiler = localStorage.getItem("show-spoiler");
        if (savedSpoiler === "true") {
            setIsShowSpoiler(true);
        }
        // Load power saving setting
        const savedPowerSaving = localStorage.getItem("power-saving");
        if (savedPowerSaving === "true") {
            setIsPowerSaving(true);
        }
        // Load trained thumbnail setting
        const savedTrainedThumbnail = localStorage.getItem("use-trained-thumbnail");
        if (savedTrainedThumbnail === "true") {
            setUseTrainedThumbnailState(true);
        }
        // Load asset source setting
        const savedAssetSource = localStorage.getItem("asset-source");
        if (savedAssetSource === "uni" || savedAssetSource === "haruki") {
            setAssetSourceState(savedAssetSource);
        }
    }, []);

    // Apply theme color to CSS variables
    useEffect(() => {
        if (mounted) {
            document.documentElement.style.setProperty("--color-miku", themeColor);
            // Also update the dark variant (darken by ~15%)
            const darkColor = darkenColor(themeColor, 15);
            document.documentElement.style.setProperty("--color-miku-dark", darkColor);

            // Update light variant for background (mix with 95% white)
            const lightColor = mixWithWhite(themeColor, 95);
            document.documentElement.style.setProperty("--theme-light", lightColor);
        }
    }, [themeColor, mounted]);

    const setThemeCharacter = (charId: string) => {
        if (CHAR_COLORS[charId]) {
            setThemeCharId(charId);
            setThemeColor(CHAR_COLORS[charId]);
            try {
                localStorage.setItem("theme-char-id", charId);
            } catch (e) {
                console.error("Failed to save theme to localStorage:", e);
            }
        } else {
            console.warn("Invalid character ID for theme:", charId);
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
            localStorage.setItem("power-saving", enabled ? "true" : "false");
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

    return (
        <ThemeContext.Provider value={{ themeCharId, themeColor, setThemeCharacter, isShowSpoiler, setShowSpoiler, isPowerSaving, setPowerSaving, useTrainedThumbnail: useTrainedThumbnailState, setUseTrainedThumbnail, assetSource: assetSourceState, setAssetSource }}>
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

// Export character data for use in settings
export { CHAR_NAMES, CHAR_COLORS };
