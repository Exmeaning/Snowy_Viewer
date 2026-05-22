export type ShortcutGroup = "navigation" | "interface" | "search" | "other";
export type ShortcutScope = "global" | "sidebar" | "commandPalette" | "page";

export interface ShortcutDefinition {
    id: string;
    group: ShortcutGroup;
    scope: ShortcutScope;
    combos: string[];
}

export interface ShortcutDisplayStep {
    keys: string[];
}

export interface ShortcutDisplayCombo {
    combo: string;
    steps: ShortcutDisplayStep[];
}

export interface ParsedShortcutStep {
    key: string;
    requireMod: boolean;
    requireCtrl: boolean;
    requireMeta: boolean;
    requireAlt: boolean;
    requireShift: boolean;
}

export type ParsedShortcutCombo = ParsedShortcutStep[];

type KeyboardLikeEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

const SHORTCUT_TOKEN_ALIASES: Record<string, string> = {
    cmd: "meta",
    command: "meta",
    option: "alt",
    return: "enter",
    esc: "escape",
    left: "arrowleft",
    right: "arrowright",
    up: "arrowup",
    down: "arrowdown",
    spacebar: "space",
};

const DISPLAY_TOKEN_MAP: Record<string, string> = {
    mod: "⌘",
    meta: "⌘",
    ctrl: "Ctrl",
    alt: "⌥",
    shift: "⇧",
    enter: "Enter",
    escape: "Esc",
    arrowleft: "←",
    arrowright: "→",
    arrowup: "↑",
    arrowdown: "↓",
    tab: "Tab",
    home: "Home",
    end: "End",
    pageup: "PgUp",
    pagedown: "PgDn",
    space: "Space",
};

export const SHORTCUT_GROUP_ORDER: ShortcutGroup[] = ["navigation", "interface", "search", "other"];

export const SHORTCUTS: ShortcutDefinition[] = [
    {
        id: "sidebar-focus-prev",
        group: "navigation",
        scope: "sidebar",
        combos: ["arrowup"],
    },
    {
        id: "sidebar-focus-next",
        group: "navigation",
        scope: "sidebar",
        combos: ["arrowdown"],
    },
    {
        id: "sidebar-open-focused",
        group: "navigation",
        scope: "sidebar",
        combos: ["enter"],
    },
    {
        id: "list-focus-next",
        group: "navigation",
        scope: "page",
        combos: ["j"],
    },
    {
        id: "list-focus-prev",
        group: "navigation",
        scope: "page",
        combos: ["k"],
    },
    {
        id: "list-open-focused",
        group: "navigation",
        scope: "page",
        combos: ["enter"],
    },
    {
        id: "navigate-home",
        group: "navigation",
        scope: "global",
        combos: ["g h"],
    },
    {
        id: "navigate-cards",
        group: "navigation",
        scope: "global",
        combos: ["g c"],
    },
    {
        id: "navigate-music",
        group: "navigation",
        scope: "global",
        combos: ["g m"],
    },
    {
        id: "navigate-events",
        group: "navigation",
        scope: "global",
        combos: ["g e"],
    },
    {
        id: "navigate-profile",
        group: "navigation",
        scope: "global",
        combos: ["g p"],
    },
    {
        id: "navigate-back",
        group: "navigation",
        scope: "global",
        combos: ["alt+arrowleft"],
    },
    {
        id: "navigate-forward",
        group: "navigation",
        scope: "global",
        combos: ["alt+arrowright"],
    },
    {
        id: "toggle-sidebar",
        group: "interface",
        scope: "global",
        combos: ["["],
    },
    {
        id: "toggle-trained-thumbnail",
        group: "interface",
        scope: "global",
        combos: ["]"],
    },
    {
        id: "toggle-settings",
        group: "interface",
        scope: "global",
        combos: ["mod+x"],
    },
    {
        id: "list-focus-filters",
        group: "interface",
        scope: "page",
        combos: ["f"],
    },
    {
        id: "list-load-more",
        group: "interface",
        scope: "page",
        combos: ["l"],
    },
    {
        id: "toggle-search",
        group: "search",
        scope: "global",
        combos: ["mod+k"],
    },
    {
        id: "list-focus-search",
        group: "search",
        scope: "page",
        combos: ["s"],
    },
    {
        id: "toggle-search-wildcard",
        group: "search",
        scope: "commandPalette",
        combos: ["mod+q"],
    },
    {
        id: "toggle-shortcuts-help",
        group: "other",
        scope: "global",
        combos: ["/", "?"],
    },
    {
        id: "close-overlay",
        group: "other",
        scope: "commandPalette",
        combos: ["escape"],
    },
    {
        id: "list-clear-focus",
        group: "other",
        scope: "page",
        combos: ["escape"],
    },
];

export function getShortcutById(id: string): ShortcutDefinition | undefined {
    return SHORTCUTS.find((shortcut) => shortcut.id === id);
}

function normalizeShortcutToken(token: string): string {
    const normalized = token.trim().toLowerCase();
    return SHORTCUT_TOKEN_ALIASES[normalized] ?? normalized;
}

export function normalizeKeyboardEventKey(key: string): string {
    if (key === " ") return "space";
    const normalized = key.trim().toLowerCase();
    return SHORTCUT_TOKEN_ALIASES[normalized] ?? normalized;
}

export function parseShortcutCombo(combo: string): ParsedShortcutCombo {
    return combo
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((stepToken) => {
            const parts = stepToken
                .split("+")
                .map((part) => normalizeShortcutToken(part))
                .filter(Boolean);

            const step: ParsedShortcutStep = {
                key: "",
                requireMod: false,
                requireCtrl: false,
                requireMeta: false,
                requireAlt: false,
                requireShift: false,
            };

            for (const part of parts) {
                if (part === "mod") {
                    step.requireMod = true;
                } else if (part === "ctrl") {
                    step.requireCtrl = true;
                } else if (part === "meta") {
                    step.requireMeta = true;
                } else if (part === "alt") {
                    step.requireAlt = true;
                } else if (part === "shift") {
                    step.requireShift = true;
                } else if (!step.key) {
                    step.key = part;
                }
            }

            return step;
        })
        .filter((step) => Boolean(step.key));
}

export function parseShortcutCombos(combos: string[]): ParsedShortcutCombo[] {
    return combos
        .map((combo) => parseShortcutCombo(combo))
        .filter((combo) => combo.length > 0);
}

export function matchesShortcutStep(event: KeyboardLikeEvent, step: ParsedShortcutStep): boolean {
    if (!step.key) return false;

    const key = normalizeKeyboardEventKey(event.key);
    if (key !== step.key) return false;

    const hasSystemModifier = event.metaKey || event.ctrlKey;
    if (step.requireMod) {
        if (!hasSystemModifier) return false;
    } else if (!step.requireCtrl && !step.requireMeta && hasSystemModifier) {
        return false;
    }

    if (step.requireCtrl && !event.ctrlKey) return false;
    if (step.requireMeta && !event.metaKey) return false;

    if (step.requireAlt) {
        if (!event.altKey) return false;
    } else if (event.altKey) {
        return false;
    }

    if (step.requireShift && !event.shiftKey) return false;

    return true;
}

export function matchesShortcutCombo(event: KeyboardLikeEvent, combo: string | ParsedShortcutCombo): boolean {
    const parsed = typeof combo === "string" ? parseShortcutCombo(combo) : combo;
    if (parsed.length !== 1) return false;
    return matchesShortcutStep(event, parsed[0]);
}

export function isKeyboardEventComposing(event: KeyboardEvent): boolean {
    if (event.isComposing) return true;
    if (event.key === "Process") return true;
    const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode;
    return keyCode === 229;
}

export function isEditableEventTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    if (target.closest("[data-shortcut-ignore='true']")) {
        return true;
    }

    const editable = target.closest(
        "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']"
    );

    if (!editable) return false;
    if (editable instanceof HTMLElement && editable.dataset.shortcutAllow === "true") {
        return false;
    }

    return true;
}

export function formatShortcutToken(token: string): string {
    const normalized = normalizeShortcutToken(token);
    if (DISPLAY_TOKEN_MAP[normalized]) {
        return DISPLAY_TOKEN_MAP[normalized];
    }

    if (normalized.length === 1) {
        return normalized.toUpperCase();
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getDisplayCombos(combos: string[]): ShortcutDisplayCombo[] {
    return combos.map((combo) => {
        const steps = combo
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((stepToken) => ({
                keys: stepToken
                    .split("+")
                    .map((keyToken) => formatShortcutToken(keyToken))
                    .filter(Boolean),
            }))
            .filter((step) => step.keys.length > 0);

        return {
            combo,
            steps,
        };
    });
}

function formatDisplayComboCompact(displayCombo: ShortcutDisplayCombo): string {
    return displayCombo.steps
        .map((step) => step.keys.join(""))
        .join(" ")
        .trim();
}

export function getPrimaryShortcutLabel(shortcutId: string): string {
    const shortcut = getShortcutById(shortcutId);
    if (!shortcut || shortcut.combos.length === 0) return "";

    const displayCombos = getDisplayCombos([shortcut.combos[0]]);
    const first = displayCombos[0];
    if (!first) return "";

    return formatDisplayComboCompact(first);
}
