"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
    DEFAULT_UI_LOCALE,
    UI_LOCALE_STORAGE_KEY,
    applyUiLocaleToDocument,
    normalizeUiLocale,
    type UiLocale,
} from "@/lib/i18n";
import { fallbackMessages, messagesByLocale } from "@/lib/i18n/messages";
import { getMessageByPath, interpolateMessage, type MessageInterpolationValues } from "@/lib/i18n/format";
import type { MessageTree } from "@/lib/i18n/messages/types";

interface I18nContextType {
    locale: UiLocale;
    setLocale: (locale: UiLocale) => void;
    t: (key: string, values?: MessageInterpolationValues) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
    messages: MessageTree;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
    children: React.ReactNode;
    initialLocale?: UiLocale;
}

function readStoredLocale(initialLocale: UiLocale): UiLocale {
    if (typeof window === "undefined") return initialLocale;

    try {
        const stored = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
        if (stored) return normalizeUiLocale(stored);
    } catch {
        // Ignore storage errors and fall back to the initial locale.
    }

    return initialLocale;
}

function persistLocale(locale: UiLocale) {
    if (typeof window === "undefined") return;

    try {
        localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
    } catch {
        // Ignore storage failures.
    }

    try {
        document.cookie = `${UI_LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
    } catch {
        // Ignore cookie failures.
    }
}

export function I18nProvider({ children, initialLocale = DEFAULT_UI_LOCALE }: I18nProviderProps) {
    const [locale, setLocaleState] = useState<UiLocale>(initialLocale);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        const resolved = readStoredLocale(initialLocale);
        setLocaleState(resolved);
        persistLocale(resolved);
        applyUiLocaleToDocument(resolved);
        setHydrated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        persistLocale(locale);
        applyUiLocaleToDocument(locale);
    }, [hydrated, locale]);

    useEffect(() => {
        if (!hydrated || typeof window === "undefined") return;

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== UI_LOCALE_STORAGE_KEY) return;
            const nextLocale = normalizeUiLocale(event.newValue ?? initialLocale);
            setLocaleState(nextLocale);
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [hydrated, initialLocale]);

    const setLocale = useCallback((nextLocale: UiLocale) => {
        setLocaleState(nextLocale);
    }, []);

    const t = useCallback((key: string, values?: MessageInterpolationValues) => {
        const currentMessages = messagesByLocale[locale] ?? fallbackMessages;
        const current = getMessageByPath(currentMessages, key) ?? getMessageByPath(fallbackMessages, key);
        if (!current) return key;
        return interpolateMessage(current, values);
    }, [locale]);

    const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
        return new Intl.NumberFormat(locale, options).format(value);
    }, [locale]);

    const formatDate = useCallback((value: Date | number | string, options?: Intl.DateTimeFormatOptions) => {
        const date = value instanceof Date ? value : new Date(value);
        return new Intl.DateTimeFormat(locale, options).format(date);
    }, [locale]);

    const messages = useMemo(() => messagesByLocale[locale] ?? fallbackMessages, [locale]);

    return (
        <I18nContext.Provider value={{ locale, setLocale, t, formatNumber, formatDate, messages }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error("useI18n must be used within an I18nProvider");
    }
    return context;
}
