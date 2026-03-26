"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

interface QuickFilterContextValue {
    /** The filter content (ReactNode) registered by the current page. */
    filterContent: React.ReactNode | null;
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
    const [filterContent, setFilterContent] = useState<React.ReactNode | null>(null);
    const [filterTitle, setFilterTitle] = useState("筛选");
    const [isOpen, setIsOpen] = useState(false);

    const registerFilters = useCallback((title: string, content: React.ReactNode) => {
        setFilterTitle(title);
        setFilterContent(content);
    }, []);

    const unregisterFilters = useCallback(() => {
        setFilterContent(null);
        setFilterTitle("筛选");
        setIsOpen(false);
    }, []);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    const value: QuickFilterContextValue = {
        filterContent,
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
 * Access the QuickFilter context (for the button/modal components).
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
 * Automatically unregisters on unmount.
 *
 * @param title  Modal title
 * @param content  The filter JSX to show in the quick filter modal
 * @param deps  Dependency array — content is re-registered when deps change
 */
export function useQuickFilter(title: string, content: React.ReactNode, deps: React.DependencyList = []) {
    const ctx = useContext(QuickFilterContext);
    const registerFilters = ctx?.registerFilters;
    const unregisterFilters = ctx?.unregisterFilters;
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia("(max-width: 767px)");
        const updateIsMobile = () => setIsMobile(mediaQuery.matches);

        updateIsMobile();
        mediaQuery.addEventListener("change", updateIsMobile);

        return () => {
            mediaQuery.removeEventListener("change", updateIsMobile);
        };
    }, []);

    useEffect(() => {
        if (!registerFilters || !unregisterFilters) return;

        if (!isMobile) {
            unregisterFilters();
            return;
        }

        registerFilters(title, content);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [registerFilters, unregisterFilters, isMobile, title, ...deps]);

    useEffect(() => {
        if (!unregisterFilters) return;
        return () => {
            unregisterFilters();
        };
    }, [unregisterFilters]);
}
