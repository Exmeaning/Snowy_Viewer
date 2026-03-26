export type ColorSchemePreference = "system" | "light" | "dark";
export type ResolvedColorScheme = "light" | "dark";

export const COLOR_SCHEME_STORAGE_KEY = "color-scheme-preference";
export const THEME_CHAR_STORAGE_KEY = "theme-char-id";
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isValidColorSchemePreference(value: string | null): value is ColorSchemePreference {
    return value === "system" || value === "light" || value === "dark";
}

export function resolveColorSchemePreference(
    preference: ColorSchemePreference,
    prefersDark: boolean
): ResolvedColorScheme {
    if (preference === "system") {
        return prefersDark ? "dark" : "light";
    }

    return preference;
}
