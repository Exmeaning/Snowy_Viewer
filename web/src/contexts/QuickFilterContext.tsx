"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useI18n } from "./I18nContext";

// ============================================================================
// Types
// ============================================================================

interface QuickFilterContextValue {
    /** The filter content (ReactNode) registered by the current page. */
    filterContent: React.ReactNode | null;
    /** Whether filter content has been registered by the active page. */
    hasFilters: boolean;
    /** Title for the quick filter modal. */
    filterTitle: string;
    /** Register filter content from a page. */
    registerFilters: (title: string, content: React.ReactNode) => void;
    /** Unregister filter content (usually on unmount). */
    unregisterFilters: () => void;
    /** Whether the quick filter modal is open. */
    isOpen: boolean;
    /** Open the quick filter modal. */
    open: () => void;
    /** Close the quick filter modal. */
    close: () => void;
    /** Toggle the quick filter modal. */
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
    const [isOpen, setIsOpen] = useState(false);

    const registerFilters = useCallback((title: string, content: React.ReactNode) => {
        setFilterTitle(title);
        setFilterContent(content);
    }, []);

    const unregisterFilters = useCallback(() => {
        setFilterContent(null);
        setFilterTitle(defaultFilterTitle);
        setIsOpen(false);
    }, [defaultFilterTitle]);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    const hasFilters = filterContent !== null;

    const value: QuickFilterContextValue = {
        filterContent,
        hasFilters,
        filterTitle,
        registerFilters,
        unregisterFilters,
        isOpen,
        open,
        close,
        toggle,
    };

    return (
        <QuickFilterContext.Provider value={value}>
            {children}
        </QuickFilterContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Access the QuickFilter context (for the button/modal components and filter rails).
 */
export function useQuickFilterContext() {
    const ctx = useContext(QuickFilterContext);
    if (!ctx) {
        throw new Error("useQuickFilterContext must be used within a QuickFilterProvider");
    }
    return ctx;
}

/**
 * Register filter content from a page component.
 * Content is registered unconditionally regardless of viewport size, allowing
 * consumers (mobile drawer QuickFilterButton, tablet Sidebar tabs, desktop FilterRail)
 * to control visibility purely via CSS breakpoints without SSR hydration mismatches.
 *
 * Automatically unregisters on unmount.
 *
 * @param title  Modal / rail title
 * @param content  The filter JSX to show in the quick filter modal / rail
 * @param deps  Dependency array — content is re-registered when deps change
 */
export function useQuickFilter(title: string, content: React.ReactNode, deps: React.DependencyList = []) {
    const ctx = useContext(QuickFilterContext);
    const registerFilters = ctx?.registerFilters;
    const unregisterFilters = ctx?.unregisterFilters;

    useEffect(() => {
        if (!registerFilters || !unregisterFilters) return;
        registerFilters(title, content);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registerFilters, unregisterFilters, title, ...deps]);

    useEffect(() => {
        if (!unregisterFilters) return;
        return () => {
            unregisterFilters();
        };
    }, [unregisterFilters]);
}
