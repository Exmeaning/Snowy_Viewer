"use client";
import React, { createContext, useContext, useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { useI18n } from "./I18nContext";
import { useIsXlScreen } from "@/hooks/useMediaQuery";
import { playHandheldSound } from "@/lib/handheld-sound";

// ============================================================================
// Storage & Store
// ============================================================================

/**
 * The user's explicit drawer preference, remembered for the browser session.
 *
 * sessionStorage rather than localStorage, matching `sidebar_open` in
 * MainLayout: a collapsed filter drawer is a transient working posture ("I am
 * scrolling the grid right now"), not a durable setting.
 */
const FILTER_DRAWER_STORAGE_KEY = "filter_drawer_open";
const FILTER_DRAWER_EVENT = "moesekai_filter_drawer_change";

export const FILTER_DRAWER_HINT_STORAGE_KEY = "moesekai_filter_drawer_hint_seen";

type UserPreference = boolean | null;

let memoryPreference: UserPreference = null;
let hasInitializedMemory = false;

function readSessionPreference(): UserPreference {
    if (typeof window === "undefined") return null;
    if (!hasInitializedMemory) {
        hasInitializedMemory = true;
        try {
            const saved = sessionStorage.getItem(FILTER_DRAWER_STORAGE_KEY);
            memoryPreference = saved === null ? null : saved === "true";
        } catch {
            memoryPreference = null;
        }
    }
    return memoryPreference;
}

const listeners = new Set<() => void>();

function subscribePreference(callback: () => void) {
    listeners.add(callback);
    const handleStorage = (e: StorageEvent) => {
        if (e.key === FILTER_DRAWER_STORAGE_KEY) {
            memoryPreference = e.newValue === null ? null : e.newValue === "true";
            callback();
        }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(FILTER_DRAWER_EVENT, callback);
    return () => {
        listeners.delete(callback);
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(FILTER_DRAWER_EVENT, callback);
    };
}

function writeSessionPreference(next: boolean) {
    memoryPreference = next;
    try {
        sessionStorage.setItem(FILTER_DRAWER_STORAGE_KEY, String(next));
    } catch {
        // Storage quota or Safari private-mode errors ignored.
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(FILTER_DRAWER_EVENT));
    }
    listeners.forEach(cb => cb());
}

// ============================================================================
// Types
// ============================================================================

interface QuickFilterContextValue {
    /** The filter content (ReactNode) registered by the current page. */
    filterContent: React.ReactNode | null;
    /** Whether filter content has been registered by the active page. */
    hasFilters: boolean;
    /** Title for the filter drawer. */
    filterTitle: string;
    /** Register filter content from a page. */
    registerFilters: (title: string, content: React.ReactNode) => void;
    /** Unregister filter content (usually on unmount). */
    unregisterFilters: () => void;
    /** Whether the filter drawer is currently expanded. */
    isOpen: boolean;
    /**
     * Whether the drawer is wide enough to sit beside the content instead of
     * floating over it. True at `>= 1280px (xl)`.
     */
    isDocked: boolean;
    /** Expand the drawer. */
    open: () => void;
    /** Collapse the drawer. */
    close: () => void;
    /** Toggle the drawer, playing the matching cue for the resulting state. */
    toggle: () => void;
}

// ============================================================================
// Context
// ============================================================================

const QuickFilterContext = createContext<QuickFilterContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function QuickFilterProvider({ children }: { children: React.ReactNode }) {
    const { t } = useI18n();
    const defaultFilterTitle = t("common.filter.title");
    const [filterContent, setFilterContent] = useState<React.ReactNode | null>(null);
    const [filterTitle, setFilterTitle] = useState(defaultFilterTitle);

    // Docking state from the SSR-safe media query hook.
    const isDocked = useIsXlScreen();

    // User preference subscribed via useSyncExternalStore (SSR safe, avoids
    // setState cascades in effects).
    const userPreference = useSyncExternalStore(
        subscribePreference,
        readSessionPreference,
        () => null
    );

    // When the user has not expressed an explicit preference in this session,
    // auto-open on wide screens ("isDocked"). Explicit preference always wins.
    const isOpen = userPreference !== null ? userPreference : isDocked;

    const registerFilters = useCallback((title: string, content: React.ReactNode) => {
        setFilterTitle(title);
        setFilterContent(content);
    }, []);

    const unregisterFilters = useCallback(() => {
        setFilterContent(null);
        setFilterTitle(defaultFilterTitle);
    }, [defaultFilterTitle]);

    const open = useCallback(() => {
        playHandheldSound("toggle");
        writeSessionPreference(true);
    }, []);

    const close = useCallback(() => {
        playHandheldSound("back");
        writeSessionPreference(false);
    }, []);

    const toggle = useCallback(() => {
        const next = !isOpen;
        playHandheldSound(next ? "toggle" : "back");
        writeSessionPreference(next);
    }, [isOpen]);

    const hasFilters = filterContent !== null;

    const value = useMemo<QuickFilterContextValue>(() => ({
        filterContent,
        hasFilters,
        filterTitle,
        registerFilters,
        unregisterFilters,
        isOpen,
        isDocked,
        open,
        close,
        toggle,
    }), [
        filterContent,
        hasFilters,
        filterTitle,
        registerFilters,
        unregisterFilters,
        isOpen,
        isDocked,
        open,
        close,
        toggle,
    ]);

    return (
        <QuickFilterContext.Provider value={value}>
            {children}
        </QuickFilterContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useQuickFilterContext() {
    const ctx = useContext(QuickFilterContext);
    if (!ctx) {
        throw new Error("useQuickFilterContext must be used within a QuickFilterProvider");
    }
    return ctx;
}

export function useQuickFilter(title: string, content: React.ReactNode, deps: React.DependencyList = []) {
    const ctx = useContext(QuickFilterContext);
    const registerFilters = ctx?.registerFilters;
    const unregisterFilters = ctx?.unregisterFilters;

    React.useEffect(() => {
        if (!registerFilters || !unregisterFilters) return;
        registerFilters(title, content);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registerFilters, unregisterFilters, title, ...deps]);

    React.useEffect(() => {
        if (!unregisterFilters) return;
        return () => {
            unregisterFilters();
        };
    }, [unregisterFilters]);
}
