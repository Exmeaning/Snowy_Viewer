"use client";
import { useCallback, useEffect, useRef } from "react";
import {
    getShortcutById,
    isEditableEventTarget,
    isKeyboardEventComposing,
    matchesShortcutCombo,
    parseShortcutCombo,
    parseShortcutCombos,
} from "@/lib/shortcuts";

export interface KeyboardShortcutHandlers {
    onToggleSidebar: () => void;
    onToggleSettings: () => void;
    onToggleSearch: () => void;
    onToggleShortcutsHelp: () => void;
    onToggleTrainedThumbnail: () => void;
    onNavigateBack: () => void;
    onNavigateForward: () => void;
    onNavigateHome: () => void;
    onNavigateCards: () => void;
    onNavigateMusic: () => void;
    onNavigateEvents: () => void;
    onNavigateProfile: () => void;
}

export interface KeyboardShortcutsOptions {
    disabled?: boolean;
    sequenceTimeoutMs?: number;
}

const DEFAULT_SEQUENCE_TIMEOUT_MS = 700;

function getParsedShortcutCombosById(shortcutId: string) {
    const combos = getShortcutById(shortcutId)?.combos ?? [];
    return parseShortcutCombos(combos);
}

function getFirstParsedShortcutComboById(shortcutId: string) {
    const parsed = getParsedShortcutCombosById(shortcutId);
    return parsed[0] ?? [];
}

function getSequenceNextKey(shortcutId: string): string {
    const combo = getShortcutById(shortcutId)?.combos[0] ?? "";
    const parsed = parseShortcutCombo(combo);
    if (parsed.length < 2) return "";
    return parsed[1]?.key ?? "";
}

const COMBO_TOGGLE_SEARCH = getFirstParsedShortcutComboById("toggle-search");
const COMBO_TOGGLE_SETTINGS = getFirstParsedShortcutComboById("toggle-settings");
const COMBO_NAVIGATE_BACK = getFirstParsedShortcutComboById("navigate-back");
const COMBO_NAVIGATE_FORWARD = getFirstParsedShortcutComboById("navigate-forward");
const COMBO_TOGGLE_SIDEBAR = getFirstParsedShortcutComboById("toggle-sidebar");
const COMBO_TOGGLE_TRAINED = getFirstParsedShortcutComboById("toggle-trained-thumbnail");
const COMBO_HELP = getParsedShortcutCombosById("toggle-shortcuts-help");

const GO_HOME_KEY = getSequenceNextKey("navigate-home");
const GO_CARDS_KEY = getSequenceNextKey("navigate-cards");
const GO_MUSIC_KEY = getSequenceNextKey("navigate-music");
const GO_EVENTS_KEY = getSequenceNextKey("navigate-events");
const GO_PROFILE_KEY = getSequenceNextKey("navigate-profile");

interface PendingSequence {
    key: "g";
    expiresAt: number;
}

/**
 * Global keyboard shortcuts hook.
 * Disabled on mobile (viewport < 768px), in editable fields, and during IME composition.
 */
export function useKeyboardShortcuts(
    handlers: KeyboardShortcutHandlers,
    options: KeyboardShortcutsOptions = {}
) {
    const pendingSequenceRef = useRef<PendingSequence | null>(null);
    const sequenceTimeoutMs = options.sequenceTimeoutMs ?? DEFAULT_SEQUENCE_TIMEOUT_MS;
    const disabled = options.disabled ?? false;

    const clearPendingSequence = useCallback(() => {
        pendingSequenceRef.current = null;
    }, []);

    useEffect(() => {
        if (disabled) {
            clearPendingSequence();
        }
    }, [disabled, clearPendingSequence]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Disable on mobile
            if (window.innerWidth < 768) {
                clearPendingSequence();
                return;
            }

            if (disabled) {
                clearPendingSequence();
                return;
            }

            if (e.defaultPrevented || isKeyboardEventComposing(e)) return;
            if (isEditableEventTarget(e.target)) {
                clearPendingSequence();
                return;
            }

            if (e.repeat) return;

            const pending = pendingSequenceRef.current;
            if (pending && pending.expiresAt < Date.now()) {
                clearPendingSequence();
            }

            if (matchesShortcutCombo(e, COMBO_TOGGLE_SEARCH)) {
                e.preventDefault();
                clearPendingSequence();
                handlers.onToggleSearch();
                return;
            }

            if (matchesShortcutCombo(e, COMBO_TOGGLE_SETTINGS)) {
                e.preventDefault();
                clearPendingSequence();
                handlers.onToggleSettings();
                return;
            }

            if (matchesShortcutCombo(e, COMBO_NAVIGATE_BACK)) {
                e.preventDefault();
                clearPendingSequence();
                handlers.onNavigateBack();
                return;
            }

            if (matchesShortcutCombo(e, COMBO_NAVIGATE_FORWARD)) {
                e.preventDefault();
                clearPendingSequence();
                handlers.onNavigateForward();
                return;
            }

            const isHelpShortcut = COMBO_HELP.some((combo) => matchesShortcutCombo(e, combo));
            if (isHelpShortcut) {
                e.preventDefault();
                clearPendingSequence();
                handlers.onToggleShortcutsHelp();
                return;
            }

            // Skip if any system modifier is held for the remaining plain shortcuts
            if (e.metaKey || e.ctrlKey || e.altKey) {
                clearPendingSequence();
                return;
            }

            // Two-key sequence: G → (H/C/M/E/P)
            if (pendingSequenceRef.current?.key === "g") {
                clearPendingSequence();
                const sequenceKey = e.key.toLowerCase();

                if (sequenceKey === GO_HOME_KEY) {
                    e.preventDefault();
                    handlers.onNavigateHome();
                } else if (sequenceKey === GO_CARDS_KEY) {
                    e.preventDefault();
                    handlers.onNavigateCards();
                } else if (sequenceKey === GO_MUSIC_KEY) {
                    e.preventDefault();
                    handlers.onNavigateMusic();
                } else if (sequenceKey === GO_EVENTS_KEY) {
                    e.preventDefault();
                    handlers.onNavigateEvents();
                } else if (sequenceKey === GO_PROFILE_KEY) {
                    e.preventDefault();
                    handlers.onNavigateProfile();
                }
                return;
            }

            // Start G sequence
            if (e.key === "g" || e.key === "G") {
                pendingSequenceRef.current = {
                    key: "g",
                    expiresAt: Date.now() + sequenceTimeoutMs,
                };
                return;
            }

            if (matchesShortcutCombo(e, COMBO_TOGGLE_SIDEBAR)) {
                e.preventDefault();
                handlers.onToggleSidebar();
                return;
            }

            if (matchesShortcutCombo(e, COMBO_TOGGLE_TRAINED)) {
                e.preventDefault();
                handlers.onToggleTrainedThumbnail();
                return;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            clearPendingSequence();
        };
    }, [handlers, sequenceTimeoutMs, clearPendingSequence, disabled]);
}
