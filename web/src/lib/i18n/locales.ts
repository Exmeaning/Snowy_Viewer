export const UI_LOCALE_STORAGE_KEY = "moesekai_ui_locale";

export const SUPPORTED_UI_LOCALES = ["zh-CN", "en-US"] as const;

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = "zh-CN";

export const UI_LOCALE_LABELS: Record<UiLocale, string> = {
    "zh-CN": "简体中文",
    "en-US": "English",
};

export const UI_LOCALE_NATIVE_NAMES: Record<UiLocale, string> = {
    "zh-CN": "简体中文",
    "en-US": "English",
};

export const UI_LOCALE_HTML_LANG: Record<UiLocale, string> = {
    "zh-CN": "zh-CN",
    "en-US": "en-US",
};

export function isUiLocale(value: unknown): value is UiLocale {
    return typeof value === "string" && (SUPPORTED_UI_LOCALES as readonly string[]).includes(value);
}

export function normalizeUiLocale(value: unknown): UiLocale {
    if (isUiLocale(value)) return value;
    if (typeof value !== "string") return DEFAULT_UI_LOCALE;

    const normalized = value.toLowerCase();
    if (normalized.startsWith("en")) return "en-US";
    if (normalized.startsWith("zh")) return "zh-CN";

    return DEFAULT_UI_LOCALE;
}

export function applyUiLocaleToDocument(locale: UiLocale) {
    if (typeof document === "undefined") return;

    document.documentElement.lang = UI_LOCALE_HTML_LANG[locale];
    document.documentElement.dataset.uiLocale = locale;
}
